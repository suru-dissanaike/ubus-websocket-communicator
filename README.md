# ubus-websocket-communicator

Helper library for openWrt ubus communication over WebSocket using RPC. Can be used towards OpenWrt WebSocket Daemon (OWSD). See the example.js for usage guidance. Has only been tested with [iopsysWRT](https://iopsys.eu/) is an enterprise software for CPE and gateway products which is based on [OpenWrt](https://openwrt.org/).

## prerequisites

If you a running iopsysWRT everything will be available by default. Just check that you have the correct access rights to access the ubus object. Access files can be found here: /usr/libexec/rpcd/ on your CPE.


## Installation

```
> npm install ubus-websocket-communicator -g
```

## Usage

An example to check if the PIN "1234" is valid as Wi-Fi Protected Setup (WPS) pin.

```javascript
"use strict";

const wsUBUS = require("UbusWebSocket");
const WS_IP = "192.168.1.1";
const WS_PORT = 80;

const WS_USER_NAME = "api";
const WS_PASSWORD = "api";

(async () => {
  const communicator = new wsUBUS(WS_IP, WS_PORT, WS_USER_NAME, WS_PASSWORD);

  try {
    await communicator.init();
    let command = {
      method: "call",
      params: [
        "router.wps",
        "checkpin",
        {
          pin: "1234"
        }
      ],
      expectedResult: {
        valid: true
      }
    };
    let response = await communicator.sendMessage(command);
    console.log(response);

    process.exit();
  } catch (e) {
    console.log(e);
  }
})();
```

## License

[GPL2](https://opensource.org/licenses/LGPL-2.0)
