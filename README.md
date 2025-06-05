# SafeTimelockUI

Basic UI to manage the SafeTimelock contract implemented at https://github.com/L1b3rtyy/safe-timelock-contract

## Functionality

Allows:
- Queuing, cancelling and executing transactions
- Changing the configuration of the SafeTimelock
- Setting and removing the Safe guard
- Upgrade the SafeTimelock implementation if upgradable
- Gathering signatures on top of the Safe's threshold to handle the cases where
  * Additional signatures are needed to cancel a transaction (```quorumCancel > threshold```)
  * Direct transaction execution is enabled (```quorumExecute > threshold```) 

More info on how to create a Safe App: [How to create a Safe App with Safe Apps SDK and list it](https://help.safe.global/en/articles/145503-how-to-create-a-safe-app-with-safe-apps-sdk-and-list-it)

Note: usage of quorumCancel and quorumExecute is not implemented yet as in the standard Safe UI there is no way yet to create a multisignature with more signatures than the default Safe's threshold.  

## Architecture

JS framework: Vue

JS Bundler: Vite

Hosting: Vercel

## Build and Deploy

0. First time only: create a vercel account at https://vercel.com/ and then initialize vercel locally
```
vercel login
vercel
```
1. Build
```
npm run build
```
2. Deploy to vercel
```
vercel --prod
```
3. First time only: import into your Safe as a Safe App: https://help.safe.global/en/articles/40859-add-a-custom-safe-app