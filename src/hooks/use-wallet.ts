import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, type JsonRpcSigner } from "ethers";
import { SEPOLIA_CHAIN_HEX, SEPOLIA_CHAIN_ID } from "@/lib/credentials/contract";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    ethereum?: any;
  }
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  const hasWallet = typeof window !== "undefined" && !!window.ethereum;

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const eth = window.ethereum;

    eth
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts?.length) setAddress(accounts[0]);
      })
      .catch(() => {});
    eth
      .request({ method: "eth_chainId" })
      .then((id: string) => setChainId(parseInt(id, 16)))
      .catch(() => {});

    const onAccounts = (accounts: string[]) => setAddress(accounts?.[0] ?? null);
    const onChain = (id: string) => setChainId(parseInt(id, 16));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error("No wallet found. Install MetaMask to continue.");
    setConnecting(true);
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0] ?? null);
      const id: string = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(parseInt(id, 16));
      return accounts[0] ?? null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) throw new Error("No wallet found.");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
    } catch (err: any) {
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_HEX,
              chainName: "Sepolia",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw err;
      }
    }
    setChainId(SEPOLIA_CHAIN_ID);
  }, []);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner> => {
    if (!window.ethereum) throw new Error("No wallet found.");
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  }, []);

  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  return { address, chainId, connecting, hasWallet, onSepolia, connect, switchToSepolia, getSigner };
}

export const shortAddress = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
