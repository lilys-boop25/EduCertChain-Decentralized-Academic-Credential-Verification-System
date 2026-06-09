// On-chain registry: authorized issuers + revocation list on Ethereum Sepolia.
import { Contract, JsonRpcProvider } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export const REGISTRY_ABI = [
  "function admin() view returns (address)",
  "function authorizedIssuers(address) view returns (bool)",
  "function revoked(bytes32) view returns (bool)",
  "function anchoredBy(bytes32) view returns (address)",
  "function addIssuer(address issuer)",
  "function removeIssuer(address issuer)",
  "function anchorCredential(bytes32 credentialId)",
  "function revokeCredential(bytes32 credentialId)",
  "event IssuerAdded(address indexed issuer)",
  "event IssuerRemoved(address indexed issuer)",
  "event CredentialAnchored(bytes32 indexed credentialId, address indexed issuer)",
  "event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer)",
];

export const getReadRegistry = (address: string) =>
  new Contract(address, REGISTRY_ABI, new JsonRpcProvider(SEPOLIA_RPC));

export const CONTRACT_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Academic Credential Registry
/// @notice Registry of authorized issuers (universities), anchored
///         credentials and a revocation list. Deploy on Sepolia.
contract CredentialRegistry {
    address public admin;

    mapping(address => bool) public authorizedIssuers;
    mapping(bytes32 => address) public anchoredBy;
    mapping(bytes32 => bool) public revoked;

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialAnchored(bytes32 indexed credentialId, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addIssuer(address issuer) external onlyAdmin {
        authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    function removeIssuer(address issuer) external onlyAdmin {
        authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice University anchors the credential id (keccak256 of metadata + Merkle root).
    function anchorCredential(bytes32 credentialId) external onlyIssuer {
        require(anchoredBy[credentialId] == address(0), "Already anchored");
        anchoredBy[credentialId] = msg.sender;
        emit CredentialAnchored(credentialId, msg.sender);
    }

    /// @notice Only the issuing university (or the admin) may revoke.
    function revokeCredential(bytes32 credentialId) external {
        require(
            msg.sender == admin || anchoredBy[credentialId] == msg.sender,
            "Not issuer of this credential"
        );
        revoked[credentialId] = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }
}
`;
