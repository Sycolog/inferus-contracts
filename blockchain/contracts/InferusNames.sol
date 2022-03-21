// SPDX-License-Identifier: GPLv3

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract InferusNames is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public basePrice;
    uint256 public totalNames;
    mapping(bytes32 => address) public names;
    mapping(bytes32 => address) public transfers;
    mapping(address => uint256) public linkingPrices;
    mapping(address => mapping(bytes32 =>bytes)) public metadataURIs;

    event NameRegistered(address indexed registrant, bytes32 name);
    event NameReleased(address indexed registrant, bytes32 name);
    event NameTransferInitiated(address indexed from, address indexed to, bytes32 name);
    event NameTransferCompleted(address indexed from, address indexed to, bytes32 name);

    function initialize(uint256 _basePrice) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        basePrice = _basePrice;
    }

    function register(bytes32 name) external payable {
        if (names[name] == msg.sender) {
            return;
        }
        require(names[name] == address(0), "NAME_NOT_AVAILABLE");
        require(msg.value == linkingPrices[msg.sender], "REGISTRATION_FEES_REQUIRED");

        // set names
        totalNames++;
        _setNameOwner(msg.sender, name);
        
        emit NameRegistered(msg.sender, name);
    }

    function release(bytes32 name) external {
        require(names[name] == msg.sender, "PERMISSION_DENIED");

        names[name] = address(0);
        transfers[name] = address(0);

        linkingPrices[msg.sender] -= basePrice;
        totalNames--;

        emit NameReleased(msg.sender, name);
    }

    function transfer(bytes32 name, address recipient) external payable {
        require(names[name] == msg.sender, "PERMISSION_DENIED");
        require(recipient != msg.sender, "SAME_ADDRESS_TRANSFER_INVALID");
        require(msg.value == basePrice, "TRANSFER_FEES_REQUIRED");

        transfers[name] = recipient;
        emit NameTransferInitiated(msg.sender, recipient, name);
    }
    
    function setMetadataURI(bytes32 name, bytes calldata uri) external {
        require(names[name] == msg.sender, "PERMISSION_DENIED");
        metadataURIs[msg.sender][name] = uri;
    }
    
    function getMetadataURI(address addr, bytes32 name) external view returns(bytes memory) {
        return metadataURIs[addr][name];
    }

    function claim(bytes32 name) external payable {
        require(transfers[name] == msg.sender, "PERMISSION_DENIED");
        require(msg.value >= linkingPrices[msg.sender], "CLAIMING_FEES_REQUIRED");

        // Reduce the name count of the original owner
        address originalOwner = names[name];
        transfers[name] = address(0);
        _setNameOwner(msg.sender, name);

        emit NameTransferCompleted(originalOwner, msg.sender, name);
    }

    function withdraw(uint256 amount) external payable onlyOwner {
        require(address(this).balance >= amount, "INSUFFICIENT_BALANCE");

        (bool sent, ) = msg.sender.call{ value: amount }("");
        require(sent, "WITHDRAWAL_FAILED");
    }
    
    function _setNameOwner(address newOwner, bytes32 name) private {
        names[name] = newOwner;
        linkingPrices[newOwner] += basePrice;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
