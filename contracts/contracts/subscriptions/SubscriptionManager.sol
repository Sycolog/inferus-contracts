// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

contract SubscriptionManager is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    enum PlanStatus {
        ACTIVE, // active and allowing new subscriptions
        PAUSED, // not allowing new subscriptions - but can be reactivated
        DEACTIVATED // terminal - cannot take new subscriptions anymore
    }

    struct SubscriptionPlan {
        uint256 id; // immutable: generated on creation
        uint256 duration; // mutable: modifiable by owner. Must not be zero.
        uint256 tokenAmount; // mutable: modifiable by owner.
        address owner; // mutable: modifiable by owner. Address of the creator. Can be changed with changePlanOwner.
        address token; // immutable: set on creation.
        PlanStatus status; // mutable. Not mutable if DEACTIVATED.
    }

    struct Subscription {
        uint256 id; // immutable: generated on creation
        uint256 planId; // immutable: set on creation
        uint256 subscribedOn; // immutable: set on creation
        uint256 expiry; // mutable: set on creation and when subscription is extended
        address subscriber; // immutable: set on creation
    }

    /**
     * @dev Special address reserved to represent the underlying coin of the chain.
     */
    address public constant COIN_ADDRESS = 0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF;

    /**
     * @dev Emitted when a user creates a subscription plan.
     */
    event CreatePlan(
        uint256 indexed id,
        address indexed owner,
        address indexed token,
        uint256 tokenAmount,
        uint256 duration,
        PlanStatus status
    );

    /**
     * @dev Emitted when a user updates the properties of a subscription plan.
     */
    event UpdatePlanProperties(
        uint256 indexed id,
        address indexed updatedBy,
        uint256 tokenAmount,
        uint256 duration,
        PlanStatus status
    );

    /**
     * @dev Emitted when a user transfers the ownership of a plan
     */
    event TransferPlanOwnership(uint256 indexed id, address indexed from, address indexed to);

    /**
     * @dev Emitted when a user subscribes to a plan
     */
    event CreateSubscription(
        uint256 indexed planId,
        uint256 indexed subscriptionId,
        address indexed subscriber,
        address subscribedBy,
        uint256 expiry
    );

    /**
     * @dev Emitted when a plan owner withdraws from the plan balance
     */
    event Withdraw(
        uint256 indexed planId,
        address indexed withdrawer,
        address withdrawnTo,
        address indexed token,
        uint256 amount
    );

    /**
     * @dev Stores the value of the last generated id.
     */
    uint256 public lastId;

    mapping(uint256 => SubscriptionPlan) public plans;
    mapping(uint256 => uint256) public planBalances;
    mapping(address => mapping(uint256 => Subscription)) public subscriptions;

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        lastId = 0;
    }

    function createPlan(
        uint256 _duration,
        address _token,
        uint256 _amount,
        bool _activate
    ) public {
        require(_duration > 0, "INVALID_DURATION");
        require(_token != address(0), "INVALID_TOKEN");

        uint256 planId = _getNextId();
        PlanStatus status = _activate ? PlanStatus.ACTIVE : PlanStatus.PAUSED;
        plans[planId] = SubscriptionPlan(planId, _duration, _amount, msg.sender, _token, status);
        emit CreatePlan(planId, msg.sender, _token, _amount, _duration, status);
    }

    function updatePlanProperties(
        uint256 _planId,
        uint256 _duration,
        uint256 _amount,
        PlanStatus _status
    ) public {
        require(_duration > 0, "INVALID_DURATION");

        SubscriptionPlan storage plan = _getActivePlan(_planId);
        require(plan.owner == msg.sender, "UNAUTHORIZED");
        plan.duration = _duration;
        plan.tokenAmount = _amount;
        plan.status = _status;
        emit UpdatePlanProperties(_planId, msg.sender, _amount, _duration, _status);
    }

    function transferPlanOwnership(uint256 _planId, address _newOwner) public {
        require(_newOwner != address(0), "INVALID_ADDRESS");

        SubscriptionPlan storage plan = _getActivePlan(_planId);
        require(plan.owner == msg.sender, "UNAUTHORIZED");
        plan.owner = _newOwner;
        emit TransferPlanOwnership(_planId, msg.sender, _newOwner);
    }

    function subscribe(uint256 _planId) public payable {
        SubscriptionPlan storage plan = _subscribeToPlan(_planId, msg.sender);
        _chargeSubscriptionForPlan(plan, msg.sender);
    }

    function subscribeWithPermit(
        uint256 _planId,
        address _subscriber,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        SubscriptionPlan storage plan = _subscribeToPlan(_planId, _subscriber);
        require(plan.token != COIN_ADDRESS, "");

        // execute permit
        IERC20PermitUpgradeable tokenPermit = IERC20PermitUpgradeable(plan.token);
        tokenPermit.permit(_subscriber, address(this), plan.tokenAmount, type(uint256).max, v, r, s);

        // execute transfer from
        _chargeSubscriptionForPlan(plan, _subscriber);
    }

    function withdrawPlanBalance(
        uint256 _planId,
        address _withdrawTo,
        uint256 _amount
    ) public payable {
        SubscriptionPlan storage plan = plans[_planId];
        require(plan.id == _planId, "INVALID_PLAN");
        require(plan.owner == msg.sender, "UNAUTHORIZED");
        require(planBalances[_planId] >= _amount, "INSUFFICIENT_PLAN_BALANCE");

        planBalances[_planId] -= _amount;
        emit Withdraw(_planId, msg.sender, _withdrawTo, plan.token, _amount);

        if (plan.token == COIN_ADDRESS) {
            (bool sent, ) = _withdrawTo.call{ value: _amount }("");
            require(sent, "COIN_TRANSFER_FAILED");
            return;
        }

        IERC20Upgradeable token = IERC20Upgradeable(plan.token);
        token.safeTransfer(_withdrawTo, _amount);
    }

    function _chargeSubscriptionForPlan(SubscriptionPlan storage _plan, address _subscriber) private {
        planBalances[_plan.id] += _plan.tokenAmount;
        if (_plan.token == COIN_ADDRESS) {
            require(msg.value == _plan.tokenAmount, "INCORRECT_AMOUNT_PAID");
            return;
        }

        IERC20Upgradeable token = IERC20Upgradeable(_plan.token);
        token.safeTransferFrom(_subscriber, address(this), _plan.tokenAmount);
    }

    function _subscribeToPlan(uint256 _planId, address _subscriber) private returns (SubscriptionPlan storage) {
        SubscriptionPlan storage plan = _getActivePlan(_planId);
        require(plan.status == PlanStatus.ACTIVE, "INACTIVE_PLAN");

        uint256 previousExpiry = subscriptions[msg.sender][_planId].expiry;
        uint256 duration = block.timestamp > previousExpiry
            ? plan.duration
            : plan.duration + previousExpiry - block.timestamp;
        uint256 subscriptionId = _getNextId();

        subscriptions[_subscriber][_planId] = Subscription(
            subscriptionId,
            _planId,
            block.timestamp,
            block.timestamp + duration,
            _subscriber
        );
        emit CreateSubscription(_planId, subscriptionId, _subscriber, msg.sender, block.timestamp + duration);

        return plan;
    }

    function _getNextId() private returns (uint256) {
        lastId++;
        return lastId;
    }

    function _getActivePlan(uint256 id) private view returns (SubscriptionPlan storage) {
        SubscriptionPlan storage plan = plans[id];
        require(plan.id == id && plan.status != PlanStatus.DEACTIVATED, "INVALID_PLAN");
        return plan;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
