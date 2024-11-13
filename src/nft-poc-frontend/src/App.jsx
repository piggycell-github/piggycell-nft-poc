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
        imageUrl: "",
        quantity: 1,
    });
    const [transferInput, setTransferInput] = useState({
        tokenId: "",
        to: "",
    });
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [approveInput, setApproveInput] = useState({
        tokenId: "",
        spender: "",
    });
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showTransferFromModal, setShowTransferFromModal] = useState(false);
    const [transferFromInput, setTransferFromInput] = useState({
        tokenId: "",
        from: "",
        to: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [forceMode, setForceMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 100;
    const [isNFTListExpanded, setIsNFTListExpanded] = useState(false);

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
        if (!identity) return false;
        try {
            const owner = await nftActor.icrc7_owner_of([Number(tokenId)]);
            return (
                owner[0][0].owner.toString() ===
                identity.getPrincipal().toText()
            );
        } catch (e) {
            console.error("소유자 확인 실패:", e);
            return false;
        }
    };

    // NFT 전송 함수
    const handleTransfer = async (e) => {
        e.preventDefault();
        setIsLoading(true);
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

            const result = await nftActor
                .icrc7_transfer(transferRequest)
                .then((res) => res[0][0]);
            await loadNFTs();

            if ("Ok" in result) {
                alert("NFT가 성공적으로 전송되었습니다.");
            } else {
                alert("전송에 실패했습니다: " + JSON.stringify(result.Err));
            }
            setShowTransferModal(false);
            setTransferInput({ tokenId: "", to: "" });
        } catch (e) {
            console.error("전송 실패:", e);
            alert("전송에 실패했습니다: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // NFT 목록 로드 함수 수정
    const loadNFTs = async () => {
        try {
            const startIndex = currentPage * PAGE_SIZE;
            const tokens = await nftActor.icrc7_tokens(
                [startIndex],
                [PAGE_SIZE],
            );

            // 다음 페이지 존재 여부 확인
            setHasMore(tokens.length === PAGE_SIZE);

            const metadata = await nftActor.icrc7_token_metadata(tokens);
            const owners = await nftActor.icrc7_owner_of(tokens);

            const nftsWithDetails = await Promise.all(
                tokens.map(async (tokenId, index) => {
                    const _isOwner = await isOwner(tokenId);
                    const isApproved = await checkApproval(tokenId);
                    return {
                        tokenId,
                        metadata: metadata[index][0][0][1].Text,
                        isOwner: _isOwner,
                        isApproved,
                        owner: owners[index][0].owner.toString(),
                    };
                }),
            );
            setNftList(nftsWithDetails);
        } catch (e) {
            console.error("NFT 목록 로드 실패:", e);
        }
    };

    // 페이지 변경 핸들러 추가
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    // useEffect 수정 - currentPage가 변경될 때마다 loadNFTs 호출
    useEffect(() => {
        if (nftActor) {
            loadNFTs();
        }
    }, [nftActor, currentPage]);

    // NFT 팅
    const handleMint = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const getMintRequestItem = (index) => ({
                token_id: BigInt(totalSupply) + BigInt(index + 1),
                owner: [
                    {
                        owner: identity.getPrincipal(),
                        subaccount: [],
                    },
                ],
                metadata: {
                    Text: JSON.stringify({
                        description: mintInput.metadata,
                        image: mintInput.imageUrl,
                    }),
                },
                memo: [],
                override: false,
                created_at_time: [],
            });

            // quantity만큼의 배열 생성
            const mintRequest = Array.from(
                { length: Number(mintInput.quantity) },
                (_, i) => getMintRequestItem(i),
            );

            const result = await nftActor
                .icrc7_mint(mintRequest)
                .then((res) => res[0]);
            await loadCollectionInfo();
            await loadNFTs();

            if ("Ok" in result) {
                alert("NFT가 성공적으로 민팅되었습니다.");
                setMintInput({ metadata: "", imageUrl: "", quantity: 1 });
            } else {
                alert("민팅에 실패했습니다.");
            }
        } catch (e) {
            console.error("민팅 실패:", e);
            alert("민팅에 실패했습니다: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // approve 함수 추가
    const handleApprove = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const approveRequest = [
                {
                    token_id: BigInt(approveInput.tokenId),
                    approval_info: {
                        spender: {
                            owner: Principal.fromText(approveInput.spender),
                            subaccount: [],
                        },
                        from_subaccount: [],
                        memo: [],
                        created_at_time: [],
                        expires_at: [],
                    },
                },
            ];

            const result = await nftActor
                .icrc37_approve_tokens(approveRequest)
                .then((res) => res[0][0]);

            if ("Ok" in result) {
                alert("NFT가 성공적으로 승인되었습니다.");
                setShowApproveModal(false);
                setApproveInput({ tokenId: "", spender: "" });
            } else {
                alert("승인에 실패했습니다.");
            }
        } catch (e) {
            console.error("승인 실패:", e);
            alert("승인에 실패했습니다: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // transferFrom 함수 추가
    const handleTransferFrom = async (tokenId, from, to) => {
        setIsLoading(true);
        try {
            const transferFromRequest = [
                {
                    token_id: BigInt(tokenId),
                    from: {
                        owner: Principal.fromText(from),
                        subaccount: [],
                    },
                    to: {
                        owner: Principal.fromText(to),
                        subaccount: [],
                    },
                    spender_subaccount: [],
                    memo: [],
                    created_at_time: [],
                },
            ];

            const result = await nftActor
                .icrc37_transfer_from(transferFromRequest)
                .then((res) => res[0][0]);
            await loadNFTs();

            if ("Ok" in result) {
                alert("승인된 NFT가 성공적으로 전송되었습니다.");
                setShowTransferFromModal(false);
            } else {
                alert("전송에 실패했습니다.");
            }
        } catch (e) {
            console.error("TransferFrom 실패:", e);
            alert("송에 실패했습니다: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // NFT 승인 여부 확인 함수 추가
    const checkApproval = async (tokenId) => {
        if (!identity) return false;

        try {
            const isApprovedRequest = [
                {
                    token_id: BigInt(tokenId),
                    from_subaccount: [],
                    spender: {
                        owner: identity.getPrincipal(),
                        subaccount: [],
                    },
                },
            ];
            const approvalResult =
                await nftActor.icrc37_is_approved(isApprovedRequest);
            return approvalResult[0];
        } catch (e) {
            console.error("승인 확인 실패:", e);
            return false;
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

    // 페이지네이션 헬퍼 함수 추가
    const getPageRange = (currentPage, totalPages, maxButtons = 5) => {
        // 전체 페이지가 최대 버튼 수보다 작은 경우
        if (totalPages <= maxButtons) {
            return Array.from({ length: totalPages }, (_, i) => i);
        }

        // 현재 페이지를 중앙에 두고 양쪽에 표시할 페이지 수 계산
        const sideButtons = Math.floor(maxButtons / 2);
        let start = currentPage - sideButtons;
        let end = currentPage + sideButtons;

        // 시작 페이지가 0보다 작은 경우 조정
        if (start < 0) {
            end += Math.abs(start);
            start = 0;
        }

        // 끝 페이지가 총 페이지수를 초과하는 경우 조정
        if (end >= totalPages) {
            start -= end - totalPages + 1;
            end = totalPages - 1;
        }

        // 시작 페이지가 0보다 작아지지 않도록 재조정
        start = Math.max(start, 0);

        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    return (
        <main className="min-h-screen bg-gray-100 p-8">
            {isLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-lg font-semibold">처리중입니다...</p>
                    </div>
                </div>
            )}
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
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={forceMode}
                                            onChange={(e) =>
                                                setForceMode(e.target.checked)
                                            }
                                        />
                                        <div
                                            className={`block w-14 h-8 rounded-full ${
                                                forceMode
                                                    ? "bg-red-500"
                                                    : "bg-gray-300"
                                            }`}
                                        ></div>
                                        <div
                                            className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${
                                                forceMode
                                                    ? "transform translate-x-6"
                                                    : ""
                                            }`}
                                        ></div>
                                    </div>
                                    <span className="ml-3 text-sm font-medium text-gray-900">
                                        Force Mode {forceMode ? "ON" : "OFF"}
                                    </span>
                                </label>
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
                    <div
                        className="flex justify-between items-center cursor-pointer"
                        onClick={() => setIsNFTListExpanded(!isNFTListExpanded)}
                    >
                        <h2 className="text-2xl font-bold">
                            NFT 목록 (
                            {totalSupply
                                .toString()
                                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            )
                        </h2>
                        <svg
                            className={`w-6 h-6 transform transition-transform ${isNFTListExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </div>

                    {isNFTListExpanded && (
                        <>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {nftList.map((nft) => (
                                    <div
                                        key={nft.tokenId.toString()}
                                        className="border rounded p-4"
                                    >
                                        <p className="font-bold">
                                            Token ID: {nft.tokenId.toString()}
                                        </p>
                                        <p>
                                            소유자:{" "}
                                            {formatPrincipalId(nft.owner)}
                                        </p>
                                        {nft.metadata &&
                                            (() => {
                                                try {
                                                    const metadata = JSON.parse(
                                                        nft.metadata,
                                                    );
                                                    return (
                                                        <>
                                                            {metadata.image && (
                                                                <img
                                                                    src={
                                                                        metadata.image
                                                                    }
                                                                    alt="NFT"
                                                                    className="w-full h-48 object-cover rounded my-2"
                                                                    onError={(
                                                                        e,
                                                                    ) => {
                                                                        e.target.onerror =
                                                                            null;
                                                                        e.target.src =
                                                                            "/placeholder.png"; // 에러 시 기본 이미지
                                                                    }}
                                                                />
                                                            )}
                                                            {metadata.description && (
                                                                <p className="text-gray-600">
                                                                    {
                                                                        metadata.description
                                                                    }
                                                                </p>
                                                            )}
                                                        </>
                                                    );
                                                } catch {
                                                    return (
                                                        <p>{nft.metadata}</p>
                                                    );
                                                }
                                            })()}
                                        {identity &&
                                            (forceMode || nft.isOwner) && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setTransferInput({
                                                                ...transferInput,
                                                                tokenId:
                                                                    nft.tokenId.toString(),
                                                            });
                                                            setShowTransferModal(
                                                                true,
                                                            );
                                                        }}
                                                        className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                                    >
                                                        전송하기
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setApproveInput({
                                                                ...approveInput,
                                                                tokenId:
                                                                    nft.tokenId.toString(),
                                                            });
                                                            setShowApproveModal(
                                                                true,
                                                            );
                                                        }}
                                                        className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                                                    >
                                                        승인하기
                                                    </button>
                                                </div>
                                            )}
                                        {identity &&
                                            (forceMode || nft.isApproved) &&
                                            (forceMode || !nft.isOwner) && (
                                                <button
                                                    onClick={() => {
                                                        setTransferFromInput({
                                                            tokenId:
                                                                nft.tokenId.toString(),
                                                            from: nft.owner,
                                                            to: identity
                                                                .getPrincipal()
                                                                .toText(),
                                                        });
                                                        setShowTransferFromModal(
                                                            true,
                                                        );
                                                    }}
                                                    className="mt-2 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                                                >
                                                    승인된 NFT 전송하기
                                                </button>
                                            )}
                                    </div>
                                ))}
                            </div>

                            {/* 페이지네이션 컨트롤 수정 */}
                            <div className="mt-6 flex flex-col items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() =>
                                            handlePageChange(currentPage - 1)
                                        }
                                        disabled={currentPage === 0}
                                        className={`px-4 py-2 rounded ${
                                            currentPage === 0
                                                ? "bg-gray-300 cursor-not-allowed"
                                                : "bg-blue-500 hover:bg-blue-600 text-white"
                                        }`}
                                    >
                                        이전
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {currentPage > 2 && (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        handlePageChange(0)
                                                    }
                                                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                                                >
                                                    1
                                                </button>
                                                <span className="px-2">
                                                    ...
                                                </span>
                                            </>
                                        )}
                                        {getPageRange(
                                            currentPage,
                                            Math.ceil(
                                                Number(totalSupply) / PAGE_SIZE,
                                            ),
                                        ).map((pageNum) => (
                                            <button
                                                key={pageNum}
                                                onClick={() =>
                                                    handlePageChange(pageNum)
                                                }
                                                className={`px-4 py-2 rounded ${
                                                    currentPage === pageNum
                                                        ? "bg-blue-500 text-white"
                                                        : "bg-gray-200 hover:bg-gray-300"
                                                }`}
                                            >
                                                {pageNum + 1}
                                            </button>
                                        ))}
                                        {currentPage <
                                            Math.ceil(
                                                Number(totalSupply) / PAGE_SIZE,
                                            ) -
                                                3 && (
                                            <>
                                                <span className="px-2">
                                                    ...
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        handlePageChange(
                                                            Math.ceil(
                                                                Number(
                                                                    totalSupply,
                                                                ) / PAGE_SIZE,
                                                            ) - 1,
                                                        )
                                                    }
                                                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                                                >
                                                    {Math.ceil(
                                                        Number(totalSupply) /
                                                            PAGE_SIZE,
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        onClick={() =>
                                            handlePageChange(currentPage + 1)
                                        }
                                        disabled={!hasMore}
                                        className={`px-4 py-2 rounded ${
                                            !hasMore
                                                ? "bg-gray-300 cursor-not-allowed"
                                                : "bg-blue-500 hover:bg-blue-600 text-white"
                                        }`}
                                    >
                                        다음
                                    </button>
                                </div>
                                <div className="text-sm text-gray-600">
                                    총{" "}
                                    {Math.ceil(Number(totalSupply) / PAGE_SIZE)}{" "}
                                    페이지 중 {currentPage + 1} 페이지
                                </div>
                            </div>
                        </>
                    )}
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
                                <label className="block mb-2">설명:</label>
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
                                    placeholder="NFT에 대한 설명을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block mb-2">
                                    이미지 URL:
                                </label>
                                <input
                                    type="url"
                                    value={mintInput.imageUrl}
                                    onChange={(e) =>
                                        setMintInput({
                                            ...mintInput,
                                            imageUrl: e.target.value,
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                    placeholder="이미지 URL을 입력하세요"
                                />
                            </div>
                            <div>
                                <label className="block mb-2">민팅 수량:</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10000"
                                    value={mintInput.quantity}
                                    onChange={(e) =>
                                        setMintInput({
                                            ...mintInput,
                                            quantity: Math.min(
                                                10000,
                                                Math.max(
                                                    1,
                                                    parseInt(e.target.value) ||
                                                        1,
                                                ),
                                            ),
                                        })
                                    }
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                NFT 민팅하기 ({mintInput.quantity}개)
                            </button>
                        </form>
                    </div>
                )}

                {/* Approve Modal */}
                {showApproveModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-lg w-96">
                            <h3 className="text-xl font-bold mb-4">NFT 승인</h3>
                            <form
                                onSubmit={handleApprove}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block mb-2">
                                        승인받을 Principal ID:
                                    </label>
                                    <input
                                        type="text"
                                        value={approveInput.spender}
                                        onChange={(e) =>
                                            setApproveInput({
                                                ...approveInput,
                                                spender: e.target.value,
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
                                            setShowApproveModal(false)
                                        }
                                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                                    >
                                        승인
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* TransferFrom 모달 추가 */}
                {showTransferFromModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-lg w-96">
                            <h3 className="text-xl font-bold mb-4">
                                승인된 NFT 전송
                            </h3>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleTransferFrom(
                                        transferFromInput.tokenId,
                                        transferFromInput.from,
                                        transferFromInput.to,
                                    );
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block mb-2">
                                        받는 사람 Principal ID:
                                    </label>
                                    <input
                                        type="text"
                                        value={transferFromInput.to}
                                        onChange={(e) =>
                                            setTransferFromInput({
                                                ...transferFromInput,
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
                                            setShowTransferFromModal(false)
                                        }
                                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                                    >
                                        전송
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default App;
