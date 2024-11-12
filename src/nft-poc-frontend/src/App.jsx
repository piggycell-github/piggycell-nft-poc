import "./tailwind.css";

import { useState, useEffect } from "react";
import {
    nft_poc_backend,
    createActor,
    canisterId,
} from "declarations/nft-poc-backend";
import { AuthClient } from "@dfinity/auth-client";
import { Secp256k1KeyIdentity } from "@dfinity/identity-secp256k1";

const userPem = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEID8yHjF4If/Ko3tq+InD+/AVlziklNZnlF/CZ5vGtSwloAcGBSuBBAAK
oUQDQgAERmaLMVW7Y4Mzqvo3WseQfmyRr0O9i2NHAQr8yWjmgj/0OsXB+p4IwGSL
pAMcoUS3Mave8bYmCZn94+EVH6n7Nw==
-----END EC PRIVATE KEY-----`;

function App() {
    const [nftActor, setNftActor] = useState(nft_poc_backend);
    const [authClient, setAuthClient] = useState(null);
    const [identity, setIdentity] = useState(null);
    const [totalSupply, setTotalSupply] = useState(0);
    const [collectionName, setCollectionName] = useState("");
    const [nftList, setNftList] = useState([]);
    const [mintInput, setMintInput] = useState({
        metadata: "",
        description: "",
    });

    // 인증 초기화
    useEffect(() => {
        initAuth();
    }, []);

    const initAuth = async () => {
        const client = await AuthClient.create();

        // client.getIdentity().getPrincipal().toUint8Array
        setAuthClient(client);

        if (await client.isAuthenticated()) {
            handleAuthenticated(client);
        }
    };

    const handleAuthenticated = async (client) => {
        const identity = client.getIdentity();
        setIdentity(identity);

        // actor 업데이트
        const actor = createActor(canisterId, {
            agentOptions: {
                identity,
            },
        });
        setNftActor(actor);
    };

    const login = async () => {
        const success = await authClient.login({
            identityProvider: process.env.II_URL,
            onSuccess: () => {
                handleAuthenticated(authClient);
            },
        });
    };

    const logout = async () => {
        await authClient.logout();
        setNftActor(nft_poc_backend);
        setIdentity(null);
    };

    const loginWithPem = async () => {
        try {
            const identity = Secp256k1KeyIdentity.fromPem(userPem);
            setIdentity(identity);

            // actor 업데이트
            const actor = createActor(canisterId, {
                agentOptions: {
                    identity,
                },
            });
            setNftActor(actor);
        } catch (e) {
            console.error("PEM 로그인 실패:", e);
        }
    };

    // NFT 컬렉션 정보 로드
    useEffect(() => {
        loadCollectionInfo();
        loadNFTs();
    }, [nftActor]);

    const loadCollectionInfo = async () => {
        try {
            const name = await nftActor.icrc7_name();
            const supply = await nftActor.icrc7_total_supply();
            setCollectionName(name);
            setTotalSupply(supply);
        } catch (e) {
            console.error("컬렉션 정보 로드 실패:", e);
        }
    };

    // NFT 목록 로드 함수
    const loadNFTs = async () => {
        try {
            // prev: null (처음부터 시작), take: 50 (한 번에 50개씩 로드)
            const tokens = await nftActor.icrc7_tokens([], []);
            const metadata = await nftActor.icrc7_token_metadata(tokens);
            const nfts = tokens.map((tokenId, index) => ({
                tokenId,
                metadata: JSON.parse(metadata[index][0][0][1].Text || "{}"),
            }));
            setNftList(nfts);
        } catch (e) {
            console.error(e);
        }
    };

    // NFT 민팅
    const handleMint = async (e) => {
        e.preventDefault();
        try {
            const mintRequest = [
                {
                    token_id: BigInt(totalSupply) + BigInt(1),
                    owner: [
                        {
                            owner: identity.getPrincipal(),
                            subaccount: [],
                        },
                    ],
                    metadata: {
                        Text: JSON.stringify({
                            description: mintInput.description,
                            data: mintInput.metadata,
                        }),
                    },
                    memo: [],
                    override: false,
                    created_at_time: [],
                },
            ];

            await nftActor.icrc7_mint(mintRequest);
            await loadCollectionInfo();
            await loadNFTs();
            setMintInput({ metadata: "", description: "" });
        } catch (e) {
            console.error("민팅 실패:", e);
        }
    };

    return (
        <main className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <img src="/logo2.svg" alt="DFINITY logo" className="h-12" />
                    <div className="space-x-2">
                        {!identity ? (
                            <>
                                <button
                                    onClick={login}
                                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                >
                                    Internet Identity로 로그인
                                </button>
                                <button
                                    onClick={loginWithPem}
                                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                                >
                                    PEM으로 로그인
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={logout}
                                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                            >
                                로그아웃
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">NFT 컬렉션 정보</h2>
                    <p>컬렉션 이름: {collectionName}</p>
                    <p>총 발행량: {totalSupply.toLocaleString()} NFTs</p>
                </div>

                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-2xl font-bold mb-4">NFT 목록</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {nftList.map((nft) => (
                            <div
                                key={nft.tokenId.toString()}
                                className="border rounded p-4"
                            >
                                <p className="font-bold">
                                    Token ID: {nft.tokenId.toString()}
                                </p>
                                {nft.metadata && (
                                    <>
                                        <p>설명: {nft.metadata.description}</p>
                                        <p>데이터: {nft.metadata.data}</p>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {identity && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-2xl font-bold mb-4">NFT 민팅</h2>
                        <form onSubmit={handleMint} className="space-y-4">
                            <div>
                                <label className="block mb-2">
                                    메타데이터:
                                </label>
                                <input
                                    type="text"
                                    value={mintInput.metadata}
                                    onChange={(e) =>
                                        setMintInput({
                                            ...mintInput,
                                            metadata: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block mb-2">설명:</label>
                                <textarea
                                    value={mintInput.description}
                                    onChange={(e) =>
                                        setMintInput({
                                            ...mintInput,
                                            description: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                NFT 민팅하기
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </main>
    );
}

export default App;
