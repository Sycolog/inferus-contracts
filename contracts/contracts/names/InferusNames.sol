// SPDX-License-Identifier: GPLv3

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract InferusNames is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using ECDSAUpgradeable for bytes32;
    uint256 public basePrice;
    uint256 public totalNames;
    mapping(bytes32 => address) public names;
    mapping(bytes32 => address) public transfers;
    mapping(address => uint256) public linkingPrices;
    mapping(bytes32 => bytes) public metadataURIs;

    event NameRegistered(address indexed registrant, bytes32 indexed name, bytes metadataURI);
    event NameReleased(address indexed registrant, bytes32 indexed name);
    event NameTransferInitiated(address indexed from, address indexed to, bytes32 name);
    event NameTransferCompleted(address indexed from, address indexed to, bytes32 name);
    event MetadataUpdated(bytes32 indexed name, bytes metadataURI);

    function initialize(uint256 _basePrice) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        basePrice = _basePrice;
        _register("inferus", address(this), hex"00");
    }

    function register(bytes32 _name, bytes calldata _metadataURI) external payable {
        _register(_name, msg.sender, _metadataURI);
    }

    function registerBySignature(
        bytes32 _name,
        address _owner,
        bytes calldata _metadataURI,
        bytes calldata _signature
    ) external payable {
        require(
            getHashForRegisterBySignature(_name, _owner, _metadataURI).toEthSignedMessageHash().recover(_signature) ==
                _owner,
            "INVALID_SIGNATURE"
        );

        _register(_name, _owner, _metadataURI);
    }

    function getHashForRegisterBySignature(
        bytes32 _name,
        address _owner,
        bytes calldata _metadataURI
    ) public view returns (bytes32) {
        return keccak256(abi.encodePacked("register(bytes32,bytes,address)", _name, _metadataURI, _owner));
    }

    function release(bytes32 _name) external {
        require(names[_name] == msg.sender, "PERMISSION_DENIED");

        names[_name] = address(0);
        transfers[_name] = address(0);

        linkingPrices[msg.sender] -= basePrice;
        totalNames--;

        emit NameReleased(msg.sender, _name);
    }

    function transfer(bytes32 _name, address _recipient) external payable {
        require(names[_name] == msg.sender, "PERMISSION_DENIED");
        require(_recipient != msg.sender, "SAME_ADDRESS_TRANSFER_INVALID");
        require(msg.value == basePrice, "TRANSFER_FEES_REQUIRED");

        transfers[_name] = _recipient;
        emit NameTransferInitiated(msg.sender, _recipient, _name);
    }

    function setMetadataURI(bytes32 _name, bytes calldata _uri) public {
        require(names[_name] == msg.sender, "PERMISSION_DENIED");
        metadataURIs[_name] = _uri;
        emit MetadataUpdated(_name, _uri);
    }

    function getMetadataURI(bytes32 _name) external view returns (bytes memory) {
        return metadataURIs[_name];
    }

    function claim(bytes32 _name) external payable {
        require(transfers[_name] == msg.sender, "PERMISSION_DENIED");
        require(msg.value >= linkingPrices[msg.sender], "CLAIMING_FEES_REQUIRED");

        // Reduce the name count of the original owner
        address originalOwner = names[_name];
        transfers[_name] = address(0);
        _setNameOwner(msg.sender, _name);

        emit NameTransferCompleted(originalOwner, msg.sender, _name);
    }

    function withdraw(uint256 _amount) external payable onlyOwner {
        require(address(this).balance >= _amount, "INSUFFICIENT_BALANCE");

        (bool sent, ) = msg.sender.call{ value: _amount }("");
        require(sent, "WITHDRAWAL_FAILED");
    }

    function setBasePrice(uint256 _basePrice) external onlyOwner {
        require(_basePrice > 0, "INVALID_AMOUNT");
        basePrice = _basePrice;
    }

    function _register(
        bytes32 _name,
        address _owner,
        bytes memory _metadataURI
    ) private {
        require(_name != hex"00", "INVALID_NAME");
        require(names[_name] == address(0), "NAME_NOT_AVAILABLE");
        require(msg.value == linkingPrices[_owner], "REGISTRATION_FEES_REQUIRED");

        // set names
        totalNames++;
        _setNameOwner(_owner, _name);
        metadataURIs[_name] = _metadataURI;

        emit NameRegistered(_owner, _name, _metadataURI);
    }

    function _setNameOwner(address _newOwner, bytes32 _name) private {
        names[_name] = _newOwner;
        linkingPrices[_newOwner] += basePrice;
    }

    function _authorizeUpgrade(address _newImplementation) internal override onlyOwner {}
}
