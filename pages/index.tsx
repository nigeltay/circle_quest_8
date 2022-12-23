import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import Modal from "react-modal";

//ABIs
import GroupBuyABI from "../utils/groupBuy.json";
import GroupBuyManagerABI from "../utils/groupBuyManager.json";
import USDCABI from "../utils/usdcContract.json";

type GroupBuys = {
  endTime: number;
  price: string; //check
  seller: string; //address
  groupBuyState: number;
  productName: string;
  productDescription: string;
  groupBuyAddress: string; //each group buy has its own contract
  buyers: string[]; //list of buyers
};

export default function Home() {
  const originalUsdcContract = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F";
  const groupBuyManagerContract = "0x905F6d8dAfe0475CcFab45Dfdb759CA81Bd210d9";

  //variables
  const [currentWalletAddress, setCurrentWalletAddress] = useState<string>("");
  const [allGroupBuys, setAllGroupBuys] = useState<GroupBuys[]>([]);
  const [createGroupBuyFields, setGroupBuyFields] = useState({
    endTime: 0,
    price: 0,
    productName: "",
    productDescription: "",
  });

  const [activeGroupBuy, setGroupBuyToActive] = useState<GroupBuys | null>(
    null
  );

  // whether or not to show the loading dialog
  const [isLoading, setIsLoading] = useState(false);

  // data to display
  const [loadedData, setLoadedData] = useState("Loading...");

  function openModal() {
    setIsLoading(true);
  }

  function closeModal() {
    setIsLoading(false);
  }

  //functions
  const getAllGroupBuys = async () => {
    const { ethereum } = window;

    // Check if MetaMask is installed
    if (!ethereum) {
      return "Make sure you have MetaMask Connected!";
    }

    // Get user Metamask Ethereum wallet address
    const accounts = await ethereum.request({
      method: "eth_requestAccounts",
    });
    // Get the first account address
    const walletAddr = accounts[0];
    setCurrentWalletAddress(walletAddr);

    if (ethereum) {
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      // Create a contract instance of your deployed GroupBuy Manager contract
      const groupBuyContractManager = new ethers.Contract(
        groupBuyManagerContract,
        GroupBuyManagerABI,
        signer
      );

      //call the getGroupBuys function from the contract to get all addresses
      const groupBuysAddresses = await groupBuyContractManager.getGroupBuys();

      //call getGroupBuyInfo function from contract
      const groupBuys = await groupBuyContractManager.getGroupBuyInfo(
        groupBuysAddresses
      );

      //loop through data and iterate
      let new_groupBuys = [];

      for (let i = 0; i < groupBuys.endTime.length; i++) {
        let endTime: number = groupBuys.endTime[i].toNumber();
        let groupBuyState: number = groupBuys.groupBuyState[i].toNumber();
        // console.log("--group buy price in blockchain: " + groupBuys.price[i]);
        let price = groupBuys.price[i]; //
        let productName: string = groupBuys.productName[i];
        let productDescription: string = groupBuys.productDescription[i];

        let sellerAddress: string = groupBuys.seller[i];

        let newGroupBuy = {
          endTime: endTime,
          price: (price / 1000000).toString(),
          seller: sellerAddress.toLowerCase(),
          groupBuyState: groupBuyState,
          productName: productName,
          productDescription: productDescription,
          groupBuyAddress: groupBuysAddresses[i],
          buyers: [],
        };
        new_groupBuys.push(newGroupBuy);
      }

      //set to variable
      setAllGroupBuys(new_groupBuys);
    }
  };

  const createGroupBuy = async () => {
    try {
      //check if required fields are empty
      if (
        !createGroupBuyFields.price ||
        !createGroupBuyFields.endTime ||
        !createGroupBuyFields.productName ||
        !createGroupBuyFields.productDescription
      ) {
        return alert("Fill all the fields");
      }

      //call create groupbuy function from the contract
      const { ethereum } = window;

      if (ethereum) {
        setLoadedData("Creating group buy...Please wait");
        openModal();

        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        //create contract instance
        const groupBuyContractManager = new ethers.Contract(
          groupBuyManagerContract,
          GroupBuyManagerABI,
          signer
        );
        //call create groupbuy function from the contract
        let { hash } = await groupBuyContractManager.createGroupbuy(
          createGroupBuyFields.endTime * 60, // Converting minutes to seconds
          ethers.utils.parseUnits(createGroupBuyFields.price.toString(), 6), //ethers.utils.parseEther(createGroupBuyFields.price.toString()),
          createGroupBuyFields.productName,
          createGroupBuyFields.productDescription,
          {
            gasLimit: 1200000,
          }
        );

        //wait for transaction to be mined
        console.log("Transaction sent! Hash:", hash);
        await provider.waitForTransaction(hash);

        console.log("Transaction mined!");
        closeModal();
        alert(`Transaction sent! Hash: ${hash}`);

        //call allGroupbuys to refresh the current list
        await getAllGroupBuys();

        //reset fields back to default values
        setGroupBuyFields({
          endTime: 0,
          price: 0,
          productName: "",
          productDescription: "",
        });
      }
    } catch (error) {
      console.log(error);
      closeModal();
      alert(`Error: ${error}`);
      return `${error}`;
    }
  };

  async function setActiveGroupBuy(groupBuy: GroupBuys) {
    const { ethereum } = window;

    if (ethereum) {
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      //create contract instance
      const groupBuyContract = new ethers.Contract(
        groupBuy.groupBuyAddress,
        GroupBuyABI,
        signer
      );

      //get all current buyers(address) and price(same for all)
      let allCurrentBuyers = await groupBuyContract.getAllOrders();

      //set current group buy to active
      setGroupBuyToActive({
        ...groupBuy,
        buyers: allCurrentBuyers,
      });
    }
  }

  function renderGroupBuys(groupBuy: GroupBuys) {
    let state = "";
    if (groupBuy.groupBuyState === 0) {
      state = "Open";
    }
    if (groupBuy.groupBuyState === 1) {
      state = "Ended";
    }

    return (
      <div className={styles.createGroupBuyContainer}>
        <p className={styles.paragraphText}>
          Product Name: {groupBuy.productName}
        </p>
        <p className={styles.paragraphText}>
          Product Description: {groupBuy.productDescription}
        </p>
        <p className={styles.paragraphText}>
          Price: {groupBuy.price || 0} USDC
        </p>
        <p className={styles.paragraphText}>
          Seller Address: {groupBuy.seller}
        </p>{" "}
        {(() => {
          if (groupBuy.groupBuyState === 0) {
            return (
              <p className={styles.paragraphText}>
                Ending in :{" "}
                {Math.round((groupBuy.endTime * 1000 - Date.now()) / 1000 / 60)}{" "}
                {/* Time left in minutes */}
                minutes
              </p>
            );
          }
        })()}
        <p className={styles.paragraphText}>Group buy State: {state}</p>
        <button
          className={styles.seeMoreBtn}
          onClick={() => {
            setActiveGroupBuy(groupBuy);
          }}
        >
          See More
        </button>
      </div>
    );
  }

  function renderSpecificGroupBuy(
    groupBuy: GroupBuys,
    currentUserWalletAddress: string
  ) {
    let state = "";
    if (groupBuy.groupBuyState === 0) {
      state = "Open";
    }
    if (groupBuy.groupBuyState === 1) {
      state = "Ended";
    }

    let isOwner = groupBuy.seller === currentUserWalletAddress;

    let isGroupBuyOpen = state === "Open"; // Check if the group buy is still open
    let hasGroupBuyEnded = state === "Ended"; // Check if the group buy has ended

    let isCurrentUserABuyer = groupBuy.buyers.some(
      (buyer) => buyer.toLowerCase() === currentUserWalletAddress
    );

    return (
      <div className={styles.activeGroupBuyContainer}>
        <div>
          <div>
            <p className={styles.paragraphText}>
              Product Name: {groupBuy.productName || 0}{" "}
            </p>
            <p className={styles.paragraphText}>
              Product Description: {groupBuy.productDescription || 0}{" "}
            </p>
            <p className={styles.paragraphText}>Price: {groupBuy.price} USDC</p>{" "}
            {/* Starting price */}
            <p className={styles.paragraphText}>
              Seller: {groupBuy.seller}
            </p>{" "}
            <div style={{ display: "flex" }}>
              <p className={styles.paragraphText}>
                Group buy Smart Contract Address:{" "}
              </p>
              <p className={styles.hyperlinkText}>
                <Link
                  href={`https://goerli.etherscan.io/address/${groupBuy.groupBuyAddress}`}
                  target="_blank"
                >
                  {groupBuy.groupBuyAddress}
                </Link>
              </p>
            </div>
            {(() => {
              if (groupBuy.groupBuyState === 0) {
                return (
                  <p className={styles.paragraphText}>
                    Ending in :{" "}
                    {Math.round(
                      (groupBuy.endTime * 1000 - Date.now()) / 1000 / 60
                    )}{" "}
                    {/* Time left in minutes */}
                    minutes
                  </p>
                );
              }
            })()}
            <p className={styles.paragraphText}>Group Buy State: {state}</p>
          </div>
          <div>
            <h3 style={{ padding: "10px" }}>List of all Buyers</h3>
            <table>
              <thead>
                <tr>
                  <th
                    style={{
                      borderColor: "black",
                      borderStyle: "groove",
                      padding: "10px",
                    }}
                  >
                    Buyer
                  </th>
                  <th
                    style={{
                      borderColor: "black",
                      borderStyle: "groove",
                      padding: "10px",
                    }}
                  >
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupBuy.buyers.map((buyer) => {
                  return (
                    <tr key={buyer}>
                      <td
                        style={{
                          borderColor: "black",
                          borderStyle: "groove",
                          padding: "10px",
                        }}
                      >
                        {buyer.toLowerCase()}
                      </td>
                      <td
                        style={{
                          borderColor: "black",
                          borderStyle: "groove",
                          padding: "10px",
                        }}
                      >
                        {groupBuy.price} USDC
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            {isGroupBuyOpen && !isOwner && !isCurrentUserABuyer ? (
              <div>
                <button
                  className={styles.placeOrderBtn}
                  onClick={() => placeOrder(activeGroupBuy)}
                >
                  Place Order
                </button>
              </div>
            ) : null}
            <button
              className={styles.backBtn}
              onClick={() => setGroupBuyToActive(null)}
            >
              Go Back
            </button>
            {isOwner && //only seller can withdraw funds
            hasGroupBuyEnded && //can only withdraw after group buy ends
            activeGroupBuy != null &&
            activeGroupBuy.buyers.length > 0 ? ( //withdraw if there are buyers
              <button
                className={styles.withdrawFundsBtn}
                onClick={() => withdrawFunds(activeGroupBuy)}
              >
                Withdraw Funds
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  async function placeOrder(currentActiveGroupBuy: GroupBuys | null) {
    try {
      const { ethereum } = window;

      if (ethereum) {
        if (currentActiveGroupBuy == null) {
          return;
        }
        setLoadedData("Getting approval...please wait");
        openModal();

        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        //give current conttact approval to take USDC from user wallet
        const usdcContract = new ethers.Contract(
          originalUsdcContract,
          USDCABI,
          signer
        );

        const usdcApprovalTxn = await usdcContract.approve(
          currentActiveGroupBuy.groupBuyAddress,
          ethers.utils.parseUnits("1000", 6)
        );
        //wait for transaction to be mined

        await usdcApprovalTxn.wait();

        closeModal();

        setLoadedData("Placing Order...please wait");
        openModal();
        //create groupbuy contract instance
        const groupBuyContract = new ethers.Contract(
          currentActiveGroupBuy.groupBuyAddress,
          GroupBuyABI,
          signer
        );

        //call place order function from group buy contract
        let { hash } = await groupBuyContract.placeOrder({
          gasLimit: 700000,
        });
        console.log("Transaction sent! Hash:", hash);
        await provider.waitForTransaction(hash); // Wait till the transaction is mined
        console.log("Transaction mined!");
        closeModal();
        alert(`Transaction sent! Hash: ${hash}`);

        //get updated buyers

        //get all current buyers(address) and price(same for all)
        let allCurrentBuyers = await groupBuyContract.getAllOrders();

        //set current group buy to active
        setGroupBuyToActive({
          ...currentActiveGroupBuy,
          buyers: allCurrentBuyers,
        });
      }
    } catch (error) {
      closeModal();
      console.log(error);
      alert(`Error: ${error}`);
      return `${error}`;
    }
  }

  async function withdrawFunds(currentActiveGroupBuy: GroupBuys | null) {
    try {
      const { ethereum } = window;

      if (ethereum) {
        if (currentActiveGroupBuy == null) {
          return;
        }
        setLoadedData("Withdrawing funds...Please wait");
        openModal();
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        //create groupBuy contract instance
        const groupBuyContract = new ethers.Contract(
          currentActiveGroupBuy.groupBuyAddress,
          GroupBuyABI,
          signer
        );

        //call place order function from group buy contract
        let { hash } = await groupBuyContract.withdrawFunds();
        console.log("Transaction sent! Hash:", hash);
        await provider.waitForTransaction(hash); // Wait till the transaction is mined
        console.log("Transaction mined!");

        setIsLoading(false);
        closeModal();
        alert(`Transaction sent! Hash: ${hash}`);
      }
    } catch (error) {
      console.log(error);
      closeModal();
      alert(`Error: ${error}`);
      return `${error}`;
    }
  }
  const customStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translate(-50%, -50%)",
      color: "black ",
    },
  };

  useEffect(() => {
    getAllGroupBuys();
  }, []);

  return (
    <>
      <Head>
        <title>Group Buying Web App</title>

        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/buy.png" />
      </Head>

      <div
        style={{
          backgroundColor: "white",
          minWidth: "500px",
          paddingBottom: "10px",
        }}
      >
        <div className={styles.topPanel}>
          <div className={styles.walletAddress}>{`Group Buying Web App`}</div>
          <div className={styles.walletAddress}>
            {`Wallet Address: ${currentWalletAddress}`}
          </div>
        </div>

        <Modal
          isOpen={isLoading}
          //onRequestClose={closeModal}
          style={customStyles}
          contentLabel="Example Modal"
        >
          {loadedData}
        </Modal>

        <h2 className={styles.allGroupBuy}>
          {(() => {
            if (activeGroupBuy == null) {
              return <div>{`All Group buys`}</div>;
            } else {
              return <div>{`Product`}</div>;
            }
          })()}
        </h2>
        {/* <div>{allGroupBuys.map((groupBuy) => renderGroupBuys(groupBuy))}</div> */}

        <div>
          {activeGroupBuy != null ? (
            renderSpecificGroupBuy(activeGroupBuy, currentWalletAddress)
          ) : (
            <div>
              {allGroupBuys.map((groupBuy) => renderGroupBuys(groupBuy))}
            </div>
          )}
        </div>

        <div className={styles.createGroupBuyContainer}>
          <h2 className={styles.createGroupBuyText}>Create Group buy</h2>

          <div style={{ margin: "20px" }}>
            <label>Product Name</label>
            <input
              type="text"
              placeholder="Enter your product name"
              onChange={(e) =>
                setGroupBuyFields({
                  ...createGroupBuyFields,
                  productName: e.target.value,
                })
              }
              value={createGroupBuyFields.productName}
              style={{
                padding: "15px",
                textAlign: "center",
                display: "block",
                width: "400px",
                backgroundColor: "black",
                color: "white",
              }}
            />
          </div>

          <div style={{ margin: "20px" }}>
            <label>Product Description</label>
            <input
              type="text"
              placeholder="Enter your product description"
              onChange={(e) =>
                setGroupBuyFields({
                  ...createGroupBuyFields,
                  productDescription: e.target.value,
                })
              }
              value={createGroupBuyFields.productDescription}
              style={{
                padding: "15px",
                textAlign: "center",
                display: "block",
                width: "400px",
                backgroundColor: "black",
                color: "white",
              }}
            />
          </div>

          <div style={{ margin: "20px" }}>
            <label>Set Price (USDC)</label>
            <input
              type="number"
              placeholder="Price"
              onChange={(e) =>
                setGroupBuyFields({
                  ...createGroupBuyFields,
                  price: parseFloat(e.target.value),
                })
              }
              value={createGroupBuyFields.price}
              style={{
                padding: "15px",
                textAlign: "center",
                display: "block",
                backgroundColor: "black",
                color: "white",
                width: "400px",
              }}
            />
          </div>

          <div style={{ margin: "20px" }}>
            <label>Duration in Mins</label>
            <input
              type="number"
              placeholder="End Time(mins)"
              onChange={(e) =>
                setGroupBuyFields({
                  ...createGroupBuyFields,
                  endTime: parseInt(e.target.value),
                })
              }
              value={createGroupBuyFields.endTime}
              style={{
                padding: "15px",
                textAlign: "center",
                display: "block",
                backgroundColor: "black",
                color: "white",
                width: "400px",
              }}
            />
          </div>

          <button
            type="button"
            className={styles.createGroupBuyBtn}
            onClick={() => createGroupBuy()}
          >
            Create Group Buy
          </button>
        </div>
      </div>
    </>
  );
}
