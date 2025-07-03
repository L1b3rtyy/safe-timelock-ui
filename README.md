# SafeTimelockUI

Basic UI to manage the SafeTimelock contract implemented at https://github.com/L1b3rtyy/safe-timelock-contract

## Using it

As of writing this the UI is deployed and hosted at https://safe-timelock-ui.vercel.app/.

It is stateless and you can deploy it on your Safe using the instructions on how to [Add a custom Safe App](https://help.safe.global/en/articles/40859-add-a-custom-safe-app)

## Functionality

Allows:
- Deploying a new guard contract 
- Setting and removing the Safe guard
- Queuing, cancelling and executing transactions
- Changing the configuration of the SafeTimelock
- Upgrading the SafeTimelock implementation if upgradable
- Gathering signatures on top of the Safe's threshold to handle the cases where
  * Additional signatures are needed to cancel a transaction (```quorumCancel > threshold```)
  * Direct transaction execution is enabled (```quorumExecute > threshold```) 
- Removing owners of suspicious transactions
- Basic alert system on queued transactions: custom heuristic to flag potentially dangerous transactions 

More info on [How to create a Safe App with Safe Apps SDK and list it](https://help.safe.global/en/articles/145503-how-to-create-a-safe-app-with-safe-apps-sdk-and-list-it)

Note: usage of ```quorumCancel``` and ```quorumExecute``` is limited to gathering signatures locally on the same machine. Having a Safe' like experience would require securely gathering signatures on a remote server and sharing them with the eventual executor. 

## Architecture

JS tooling
- JS framework: [Vue](https://vuejs.org/)
- JS Bundler: [Vite](https://vite.dev/)
- Hosting: [Vercel](https://vercel.com/)

Ethereum client tooling:
- [Ethers](https://docs.ethers.org/v5/)
- [safe-apps-sdk](https://github.com/safe-global/safe-apps-sdk)
- [safe-protocol-kit](https://github.com/safe-global/safe-core-sdk/tree/main/packages/protocol-kit)

## Build and Deploy

0. Local deployment
```
npm run dev
```
1. First time only: create a [vercel](https://vercel.com/) account and then initialize vercel locally
```
vercel login
vercel
```
2. Build and deploy
```
npm run deploy
```

This will pre-increment the patch version in ```package.json``` and then call ```vercel --prod``.

3. First time only: [Add a custom Safe App](https://help.safe.global/en/articles/40859-add-a-custom-safe-app)