import "./tailwind.css";

import { useState, useEffect } from "react";
import {
    nft_poc_backend,
    createActor,
    canisterId,
} from "declarations/nft-poc-backend";
import { AuthClient } from "@dfinity/auth-client";
import { Secp256k1KeyIdentity } from "@dfinity/identity-secp256k1";
import { Principal } from "@dfinity/principal";

const userPem = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEID8yHjF4If/Ko3tq+InD+/AVlziklNZnlF/CZ5vGtSwloAcGBSuBBAAK
oUQDQgAERmaLMVW7Y4Mzqvo3WseQfmyRr0O9i2NHAQr8yWjmgj/0OsXB+p4IwGSL
pAMcoUS3Mave8bYmCZn94+EVH6n7Nw==
-----END EC PRIVATE KEY-----`;

const userPem2 = `-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIPni6aE5QHw/GWLGZHJgf5TCJNPFpoI26mzlW/QyMvRooAcGBSuBBAAK
oUQDQgAE6BJAH55JTbnx9Uz8YAZaF1Af1qdgEb2Y8Vcso8rMRG5/56T4sJdFjmYE
42xEhBi4HZlkP/3fd8hOLtw27qBOGw==
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
    });
    const [transferInput, setTransferInput] = useState({
        tokenId: "",
        to: "",
    });
    const [showTransferModal, setShowTransferModal] = useState(false);

    // 인증 초기화
    useEffect(() => {
        initAuth();
    }, []);

    const initAuth = async () => {
        const client = await AuthClient.create();

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

    const loginWithPem1 = async () => {
        try {
            const identity = Secp256k1KeyIdentity.fromPem(userPem);
            setIdentity(identity);

            const actor = createActor(canisterId, {
                agentOptions: {
                    identity,
                },
            });
            setNftActor(actor);
        } catch (e) {
            console.error("PEM1 로그인 실패:", e);
        }
    };

    const loginWithPem2 = async () => {
        try {
            const identity = Secp256k1KeyIdentity.fromPem(userPem2);
            setIdentity(identity);

            const actor = createActor(canisterId, {
                agentOptions: {
                    identity,
                },
            });
            setNftActor(actor);
        } catch (e) {
            console.error("PEM2 로그인 실패:", e);
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

    // NFT 소유자 확인 함수
    const isOwner = async (tokenId) => {
        try {
            const owner = await nftActor.icrc7_owner_of([Number(tokenId)]);
            return (
                owner[0][0].owner.toString() ===
                identity?.getPrincipal().toText()
            );
        } catch (e) {
            console.error("소유자 확인 실패:", e);
            return false;
        }
    };

    // NFT 전송 함수
    const handleTransfer = async (e) => {
        e.preventDefault();
        try {
            const transferRequest = [
                {
                    token_id: BigInt(transferInput.tokenId),
                    from_subaccount: [],
                    to: {
                        owner: Principal.fromText(transferInput.to),
                        subaccount: [],
                    },
                    memo: [],
                    created_at_time: [],
                },
            ];

            await nftActor.icrc7_transfer(transferRequest);
            await loadNFTs();
            setShowTransferModal(false);
            setTransferInput({ tokenId: "", to: "" });
        } catch (e) {
            console.error("전송 실패:", e);
        }
    };

    // NFT 목록 로드 함수 수정
    const loadNFTs = async () => {
        try {
            const tokens = await nftActor.icrc7_tokens([], []);
            const metadata = await nftActor.icrc7_token_metadata(tokens);
            const nftsWithOwnership = await Promise.all(
                tokens.map(async (tokenId, index) => ({
                    tokenId,
                    metadata: metadata[index][0][0][1].Text,
                    isOwner: await isOwner(tokenId),
                })),
            );
            setNftList(nftsWithOwnership);
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
                        Text: mintInput.metadata,
                    },
                    memo: [],
                    override: false,
                    created_at_time: [],
                },
            ];

            await nftActor.icrc7_mint(mintRequest);
            await loadCollectionInfo();
            await loadNFTs();
            setMintInput({ metadata: "" });
        } catch (e) {
            console.error("민팅 실패:", e);
        }
    };

    // Principal ID 컴포넌트 추가
    const PrincipalDisplay = ({ principal }) => {
        const copyToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(principal.toString());
                alert("Principal ID가 클립보드에 복사되었습니다.");
            } catch (err) {
                console.error("클립보드 복사 실패:", err);
            }
        };

        return (
            <span className="flex items-center gap-2 text-gray-600">
                <span>Principal: {formatPrincipalId(principal)}</span>
                <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="클릭하여 복사하기"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-500 hover:text-blue-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                    </svg>
                </button>
            </span>
        );
    };

    // Principal ID를 포맷팅하는 함수 추가
    const formatPrincipalId = (principal) => {
        if (!principal) return "";
        const text = principal.toString();
        if (text.length <= 12) return text;
        return `${text.slice(0, 8)}...${text.slice(-8)}`;
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
                                    onClick={loginWithPem1}
                                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                                >
                                    PEM1으로 로그인
                                </button>
                                <button
                                    onClick={loginWithPem2}
                                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                                >
                                    PEM2로 로그인
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-4">
                                <PrincipalDisplay
                                    principal={identity.getPrincipal()}
                                />
                                <button
                                    onClick={logout}
                                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                                >
                                    로그아웃
                                </button>
                            </div>
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
                                {nft.metadata && <p>{nft.metadata}</p>}
                                {nft.isOwner && (
                                    <button
                                        onClick={() => {
                                            setTransferInput({
                                                ...transferInput,
                                                tokenId: nft.tokenId.toString(),
                                            });
                                            setShowTransferModal(true);
                                        }}
                                        className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                    >
                                        전송하기
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Transfer Modal */}
                {showTransferModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-lg w-96">
                            <h3 className="text-xl font-bold mb-4">NFT 전송</h3>
                            <form
                                onSubmit={handleTransfer}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block mb-2">
                                        받는 사람 Principal ID:
                                    </label>
                                    <input
                                        type="text"
                                        value={transferInput.to}
                                        onChange={(e) =>
                                            setTransferInput({
                                                ...transferInput,
                                                to: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowTransferModal(false)
                                        }
                                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                    >
                                        전송
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

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
