// @ts-check
import { ethers } from "ethers";
import proxyAdminAbi from "./ProxyAdminABI.json";
import proxyAbi from "./ProxyABI.json";
import {proxyBytecode, proxyAdminBytecode} from "./ContractsBytecode.json";

async function deployContract(statusCallback, methodCall, signer, abi, bytecode, ...args) {
  console.log("deployContract - args=" + args);
  statusCallback("Deploying with " + await signer.getAddress());
  const factory = new ethers.ContractFactory(abi, bytecode, signer)
  const contract = await factory.deploy(...args);
  statusCallback("Waiting for deployment to be confirmed...");
  await contract.deployed();
  console.log("Contract deployed at:", contract.address);
  if(methodCall) {
    statusCallback("Deployed at " + contract.address + "<br>Now calling " + methodCall.func);  
    const tx = await contract[methodCall.func](...methodCall.args);
    await tx.wait();
    statusCallback("Deployed at " + contract.address+ "<br>" + methodCall.func + " done");
  }
  else
    statusCallback("Deployed at " + contract.address);
  return contract;
}
export async function deploy(implementationAddress, safeAddress, timelockDuration, throttle, limitNoTimelock, quorumCancel, quorumExecute,
  proxyAdminAddress, setProxyAdminAddress,
  proxyAddress, setProxyAddress,
  proxyAdminStatus,
  proxyStatus) {
  console.log("deploy - params=" + [implementationAddress, safeAddress, timelockDuration, throttle, limitNoTimelock, quorumCancel, quorumExecute]);
  if(proxyAdminAddress && proxyAddress)
    throw new Error("Already deployed, reset to redeploy");
  if(!window.ethereum)
    throw new Error("No wallet detected (e.g. Metamask)");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();

  if(!proxyAdminAddress) {
    const proxyAdmin = await deployContract(proxyAdminStatus, {func: "transferOwnership", args: [safeAddress]},
      signer, proxyAdminAbi, proxyAdminBytecode);
    setProxyAdminAddress(proxyAdmin.address);
    proxyAdminAddress = proxyAdmin.address;
  }
  
  const initIface = new ethers.utils.Interface(["function initialize(address safe, uint64 timelockDuration, uint64 throttle, uint128 limitNoTimelock, uint8 quorumCancel, uint8 quorumExecute)"]);
  const initData = initIface.encodeFunctionData("initialize", [safeAddress, timelockDuration, throttle, ethers.utils.parseEther(limitNoTimelock.toString()).toString(), quorumCancel, quorumExecute]);
  const proxy = await deployContract(proxyStatus, null, 
    signer, proxyAbi, proxyBytecode, implementationAddress, proxyAdminAddress, initData);
  setProxyAddress(proxy.address);
}