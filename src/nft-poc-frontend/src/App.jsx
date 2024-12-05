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

const CONFIG = {
    API: {
        BASE_URL: "https://app.piggycell.com",
        ENDPOINTS: {
            LIST: "/api/v1/seller/list",
            DYNAMIC_LIST: "/api/v1/seller/dynamic-list",
        },
    },
    NFT: {
        IMAGE_URLS: [
            "https://namulabs-public-assets.s3.ap-northeast-2.amazonaws.com/hub8.jpeg",
            "https://namulabs-public-assets.s3.ap-northeast-2.amazonaws.com/hub16.jpeg",
            "https://namulabs-public-assets.s3.ap-northeast-2.amazonaws.com/hub32.jpeg",
            "https://namulabs-public-assets.s3.ap-northeast-2.amazonaws.com/hub64.jpeg",
        ],
        PAGE_SIZE: 100,
    },
    KEYS: {
        PEM1: userPem,
        PEM2: userPem2,
    },
    MODALS: {
        TRANSFER: "transfer",
        APPROVE: "approve",
        TRANSFER_FROM: "transferFrom",
    },
};

function App() {
    const [nftActor, setNftActor] = useState(nft_poc_backend);
    const [authClient, setAuthClient] = useState(null);
    const [identity, setIdentity] = useState(null);
    const [totalSupply, setTotalSupply] = useState(0);
    const [collectionName, setCollectionName] = useState("");
    const [nftList, setNftList] = useState([]);
    const [modalState, setModalState] = useState({
        activeModal: null,
        data: {},
    });
    const [inputState, setInputState] = useState({
        mint: {
            metadata: "",
            imageUrl: "",
            quantity: 1,
        },
        transfer: {
            tokenId: "",
            to: "",
        },
        approve: {
            tokenId: "",
            spender: "",
        },
        transferFrom: {
            tokenId: "",
            from: "",
            to: "",
        },
    });
    const [isLoading, setIsLoading] = useState(false);
    const [forceMode, setForceMode] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isNFTListExpanded, setIsNFTListExpanded] = useState(false);
    const [isNFTMintExpanded, setIsNFTMintExpanded] = useState(false);

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
            const identity = Secp256k1KeyIdentity.fromPem(CONFIG.KEYS.PEM1);
            setIdentity(identity);

            const actor = createActor(canisterId, {
                agentOptions: {
                    identity,
                },
            });
            setNftActor(actor);
        } catch (e) {
            console.error("Failed to login with PEM1:", e);
        }
    };

    const loginWithPem2 = async () => {
        try {
            const identity = Secp256k1KeyIdentity.fromPem(CONFIG.KEYS.PEM2);
            setIdentity(identity);

            const actor = createActor(canisterId, {
                agentOptions: {
                    identity,
                },
            });
            setNftActor(actor);
        } catch (e) {
            console.error("Failed to login with PEM2:", e);
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
            console.error("Failed to load collection info:", e);
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
            console.error("Failed to verify owner:", e);
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
                    token_id: BigInt(inputState.transfer.tokenId),
                    from_subaccount: [],
                    to: {
                        owner: Principal.fromText(inputState.transfer.to),
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
                alert("NFT has been transferred successfully.");
            } else {
                alert("Transfer failed: " + JSON.stringify(result.Err));
            }
            closeModal();
        } catch (e) {
            console.error("Transfer failed:", e);
            alert("Transfer failed: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // NFT 목록 로드 함수 수정
    const loadNFTs = async () => {
        try {
            const startIndex = currentPage * CONFIG.NFT.PAGE_SIZE;
            const tokens = await nftActor.icrc7_tokens(
                [startIndex],
                [CONFIG.NFT.PAGE_SIZE],
            );

            // 다음 페이지 존재 여부 확인
            setHasMore(tokens.length === CONFIG.NFT.PAGE_SIZE);

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
            console.error("Failed to load NFT list:", e);
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

    // NFT 민팅
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
                        description: inputState.mint.metadata,
                        image: inputState.mint.imageUrl,
                    }),
                },
                memo: [],
                override: false,
                created_at_time: [],
            });

            // quantity만큼의 배열 생성
            const mintRequest = Array.from(
                { length: Number(inputState.mint.quantity) },
                (_, i) => getMintRequestItem(i),
            );

            const result = await nftActor
                .icrc7_mint(mintRequest)
                .then((res) => res[0]);
            await loadCollectionInfo();
            await loadNFTs();

            if ("Ok" in result) {
                alert("NFT has been minted successfully.");
                setInputState({
                    ...inputState,
                    mint: {
                        metadata: "",
                        imageUrl: "",
                        quantity: 1,
                    },
                });
            } else {
                alert("Minting failed.");
            }
        } catch (e) {
            console.error("Minting failed:", e);
            alert("Minting failed: " + e.message);
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
                    token_id: BigInt(inputState.approve.tokenId),
                    approval_info: {
                        spender: {
                            owner: Principal.fromText(
                                inputState.approve.spender,
                            ),
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
                alert("NFT has been approved successfully.");
                closeModal();
                setInputState({
                    ...inputState,
                    approve: {
                        tokenId: "",
                        spender: "",
                    },
                });
            } else {
                alert("Approval failed.");
            }
        } catch (e) {
            console.error("Approval failed:", e);
            alert("Approval failed: " + e.message);
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
                alert("Approved NFT has been transferred successfully.");
                closeModal();
            } else {
                alert("Transfer failed.");
            }
        } catch (e) {
            console.error("TransferFrom failed:", e);
            alert("Transfer failed: " + e.message);
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
            console.error("Failed to check approval:", e);
            return false;
        }
    };

    // Principal ID 컴포넌트 추가
    const PrincipalDisplay = ({ principal }) => {
        const copyToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(principal.toString());
                alert("Principal ID has been copied to clipboard.");
            } catch (err) {
                console.error("Failed to copy to clipboard:", err);
            }
        };

        return (
            <span className="flex items-center gap-2 text-gray-600">
                <span>Principal: {formatPrincipalId(principal)}</span>
                <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Click to copy"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5 text-gray-500 hover:text-blue-500"
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

    // PiggyCell 데이터로 NFT 민팅하는 함수 추가
    const handlePiggyCellMint = async () => {
        setIsLoading(true);
        try {
            const piggyCellData = await fetchPiggyCellData();

            const mintRequests = piggyCellData.map((item, index) => ({
                token_id: BigInt(totalSupply) + BigInt(index + 1),
                owner: [
                    {
                        owner: identity.getPrincipal(),
                        subaccount: [],
                    },
                ],
                metadata: {
                    Text: JSON.stringify({
                        description: item.name,
                        image: getNftImageUrl(item.stock + item.surplus),
                        slot: item.stock + item.surplus,
                    }),
                },
                memo: [],
                override: false,
                created_at_time: [],
            }));

            const result = await nftActor
                .icrc7_mint(mintRequests)
                .then((res) => res[0]);
            await loadCollectionInfo();
            await loadNFTs();

            if ("Ok" in result) {
                alert(
                    `${piggyCellData.length} NFTs have been minted successfully.`,
                );
            } else {
                alert("Minting failed.");
            }
        } catch (e) {
            console.error("PiggyCell minting failed:", e);
            alert("Minting failed: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 모달 헬퍼 함수들
    const openModal = (modalType, data = {}) => {
        setModalState({
            activeModal: modalType,
            data,
        });
    };

    const closeModal = () => {
        setModalState({
            activeModal: null,
            data: {},
        });
    };

    // 입력값 업데이트 헬퍼 함수
    const updateInput = (type, field, value) => {
        setInputState((prev) => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value,
            },
        }));
    };

    // 모달 렌더링 함수
    const renderModal = () => {
        const modalProps = {
            [CONFIG.MODALS.TRANSFER]: {
                title: "Transfer NFT",
                onSubmit: handleTransfer,
                content: (
                    <div>
                        <label className="block mb-2">
                            Recipient Principal ID:
                        </label>
                        <input
                            type="text"
                            value={inputState.transfer.to}
                            onChange={(e) =>
                                updateInput("transfer", "to", e.target.value)
                            }
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>
                ),
            },
            [CONFIG.MODALS.APPROVE]: {
                title: "Approve NFT",
                onSubmit: handleApprove,
                content: (
                    <div>
                        <label className="block mb-2">
                            Principal ID to approve:
                        </label>
                        <input
                            type="text"
                            value={inputState.approve.spender}
                            onChange={(e) =>
                                updateInput(
                                    "approve",
                                    "spender",
                                    e.target.value,
                                )
                            }
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>
                ),
            },
            [CONFIG.MODALS.TRANSFER_FROM]: {
                title: "Transfer Approved NFT",
                onSubmit: (e) => {
                    e.preventDefault();
                    handleTransferFrom(
                        inputState.transferFrom.tokenId,
                        inputState.transferFrom.from,
                        inputState.transferFrom.to,
                    );
                },
                content: (
                    <div>
                        <label className="block mb-2">
                            Recipient Principal ID:
                        </label>
                        <input
                            type="text"
                            value={inputState.transferFrom.to}
                            onChange={(e) =>
                                updateInput(
                                    "transferFrom",
                                    "to",
                                    e.target.value,
                                )
                            }
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>
                ),
            },
        };

        const activeModalConfig = modalProps[modalState.activeModal];
        if (!activeModalConfig) return null;

        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="p-6 bg-white rounded-lg w-96">
                    <h3 className="mb-4 text-xl font-bold">
                        {activeModalConfig.title}
                    </h3>
                    <form
                        onSubmit={activeModalConfig.onSubmit}
                        className="space-y-4"
                    >
                        {activeModalConfig.content}
                        <div className="flex justify-end space-x-2">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="px-4 py-2 text-white bg-gray-500 rounded hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600"
                            >
                                Confirm
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <main className="min-h-screen p-8 bg-gray-100">
            {isLoading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="flex flex-col items-center p-6 bg-white rounded-lg">
                        <div className="w-12 h-12 mb-4 border-b-2 border-blue-500 rounded-full animate-spin"></div>
                        <p className="text-lg font-semibold">Processing...</p>
                    </div>
                </div>
            )}
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <img src="/logo2.svg" alt="DFINITY logo" className="h-12" />
                    <div className="space-x-2">
                        {!identity ? (
                            <>
                                <button
                                    onClick={login}
                                    className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600"
                                >
                                    Login with Internet Identity
                                </button>
                                <button
                                    onClick={loginWithPem1}
                                    className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600"
                                >
                                    Login with PEM1
                                </button>
                                <button
                                    onClick={loginWithPem2}
                                    className="px-4 py-2 text-white bg-purple-500 rounded hover:bg-purple-600"
                                >
                                    Login with PEM2
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
                                    className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 mb-6 bg-white rounded-lg shadow">
                    <h2 className="mb-4 text-2xl font-bold">
                        NFT Collection Info
                    </h2>
                    <p>Collection Name: {collectionName}</p>
                    <p>Total Supply: {totalSupply.toLocaleString()} NFTs</p>
                </div>

                <div className="p-6 mb-6 bg-white rounded-lg shadow">
                    <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setIsNFTListExpanded(!isNFTListExpanded)}
                    >
                        <h2 className="text-2xl font-bold">
                            NFT List (
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
                            <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2 lg:grid-cols-3">
                                {nftList.map((nft) => (
                                    <div
                                        key={nft.tokenId.toString()}
                                        className="p-4 border rounded"
                                    >
                                        {nft.metadata &&
                                            (() => {
                                                try {
                                                    const metadata = JSON.parse(
                                                        nft.metadata,
                                                    );
                                                    return (
                                                        <>
                                                            {metadata.description && (
                                                                <p className="mb-2 text-lg font-bold">
                                                                    {
                                                                        metadata.description
                                                                    }
                                                                </p>
                                                            )}
                                                            {metadata.image && (
                                                                <img
                                                                    src={
                                                                        metadata.image
                                                                    }
                                                                    alt="NFT"
                                                                    className="object-cover w-full h-48 my-2 rounded"
                                                                    onError={(
                                                                        e,
                                                                    ) => {
                                                                        e.target.onerror =
                                                                            null;
                                                                        e.target.src =
                                                                            "/placeholder.png";
                                                                    }}
                                                                />
                                                            )}
                                                            {metadata.slot && (
                                                                <p className="mt-2 text-sm text-gray-600">
                                                                    Slots:{" "}
                                                                    {
                                                                        metadata.slot
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
                                        <p className="mb-2 text-gray-600">
                                            Owner:{" "}
                                            {formatPrincipalId(nft.owner)}
                                        </p>
                                        <p className="mt-4 text-xs text-gray-400">
                                            Token ID: {nft.tokenId.toString()}
                                        </p>
                                        {identity &&
                                            (forceMode || nft.isOwner) && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setInputState({
                                                                ...inputState,
                                                                transfer: {
                                                                    ...inputState.transfer,
                                                                    tokenId:
                                                                        nft.tokenId.toString(),
                                                                },
                                                            });
                                                            openModal(
                                                                CONFIG.MODALS
                                                                    .TRANSFER,
                                                            );
                                                        }}
                                                        className="px-4 py-2 mt-2 text-white bg-blue-500 rounded hover:bg-blue-600"
                                                    >
                                                        Transfer
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setInputState({
                                                                ...inputState,
                                                                approve: {
                                                                    ...inputState.approve,
                                                                    tokenId:
                                                                        nft.tokenId.toString(),
                                                                },
                                                            });
                                                            openModal(
                                                                CONFIG.MODALS
                                                                    .APPROVE,
                                                            );
                                                        }}
                                                        className="px-4 py-2 mt-2 text-white bg-green-500 rounded hover:bg-green-600"
                                                    >
                                                        Approve
                                                    </button>
                                                </div>
                                            )}
                                        {identity &&
                                            (forceMode || nft.isApproved) &&
                                            (forceMode || !nft.isOwner) && (
                                                <button
                                                    onClick={() => {
                                                        setInputState({
                                                            ...inputState,
                                                            transferFrom: {
                                                                ...inputState.transferFrom,
                                                                tokenId:
                                                                    nft.tokenId.toString(),
                                                                from: nft.owner,
                                                                to: identity
                                                                    .getPrincipal()
                                                                    .toText(),
                                                            },
                                                        });
                                                        openModal(
                                                            CONFIG.MODALS
                                                                .TRANSFER_FROM,
                                                        );
                                                    }}
                                                    className="px-4 py-2 mt-2 text-white bg-purple-500 rounded hover:bg-purple-600"
                                                >
                                                    Transfer Approved NFT
                                                </button>
                                            )}
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex flex-col items-center gap-4 mt-6">
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
                                        Previous
                                    </button>
                                    <div className="flex items-center gap-2">
                                        {currentPage > 2 && (
                                            <>
                                                <button
                                                    onClick={() =>
                                                        handlePageChange(0)
                                                    }
                                                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
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
                                                Number(totalSupply) /
                                                    CONFIG.NFT.PAGE_SIZE,
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
                                                Number(totalSupply) /
                                                    CONFIG.NFT.PAGE_SIZE,
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
                                                                ) /
                                                                    CONFIG.NFT
                                                                        .PAGE_SIZE,
                                                            ) - 1,
                                                        )
                                                    }
                                                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                                                >
                                                    {Math.ceil(
                                                        Number(totalSupply) /
                                                            CONFIG.NFT
                                                                .PAGE_SIZE,
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
                                        Next
                                    </button>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Page {currentPage + 1} of{" "}
                                    {Math.ceil(
                                        Number(totalSupply) /
                                            CONFIG.NFT.PAGE_SIZE,
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {renderModal()}

                {identity && (
                    <div className="p-6 bg-white rounded-lg shadow">
                        <h2 className="mb-4 text-2xl font-bold">Mint NFT</h2>
                        <div className="space-y-4">
                            <button
                                onClick={handlePiggyCellMint}
                                className="w-full px-4 py-2 text-white bg-indigo-500 rounded hover:bg-indigo-600"
                            >
                                Mint NFT with PiggyCell Data
                            </button>

                            <div className="border rounded-lg">
                                <button
                                    onClick={() =>
                                        setIsNFTMintExpanded(!isNFTMintExpanded)
                                    }
                                    className="flex items-center justify-between w-full p-4 hover:bg-gray-50"
                                >
                                    <span className="font-semibold">
                                        Mint General NFT
                                    </span>
                                    <svg
                                        className={`w-6 h-6 transform transition-transform ${
                                            isNFTMintExpanded
                                                ? "rotate-180"
                                                : ""
                                        }`}
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
                                </button>

                                {isNFTMintExpanded && (
                                    <div className="p-4 border-t">
                                        <form
                                            onSubmit={handleMint}
                                            className="space-y-4"
                                        >
                                            <div>
                                                <label className="block mb-2">
                                                    Description:
                                                </label>
                                                <input
                                                    type="text"
                                                    value={
                                                        inputState.mint.metadata
                                                    }
                                                    onChange={(e) =>
                                                        updateInput(
                                                            "mint",
                                                            "metadata",
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full p-2 border rounded"
                                                    placeholder="Enter a description for the NFT"
                                                />
                                            </div>
                                            <div>
                                                <label className="block mb-2">
                                                    Image URL:
                                                </label>
                                                <input
                                                    type="url"
                                                    value={
                                                        inputState.mint.imageUrl
                                                    }
                                                    onChange={(e) =>
                                                        updateInput(
                                                            "mint",
                                                            "imageUrl",
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="w-full p-2 border rounded"
                                                    placeholder="Enter the image URL"
                                                />
                                            </div>
                                            <div>
                                                <label className="block mb-2">
                                                    Quantity:
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="10000"
                                                    value={
                                                        inputState.mint.quantity
                                                    }
                                                    onChange={(e) =>
                                                        updateInput(
                                                            "mint",
                                                            "quantity",
                                                            Math.min(
                                                                10000,
                                                                Math.max(
                                                                    1,
                                                                    parseInt(
                                                                        e.target
                                                                            .value,
                                                                    ) || 1,
                                                                ),
                                                            ),
                                                        )
                                                    }
                                                    className="w-full p-2 border rounded"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="w-full px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600"
                                            >
                                                Mint NFT (
                                                {inputState.mint.quantity}{" "}
                                                items)
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

export default App;
