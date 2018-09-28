/*
 * Copyright (C) 2018 iopsys Software Solutions AB.
 *
 * All rights reserved.
 *
 * Author:        Suru Dissanaike   <suru.dissanaike@iopsys.eu>
 * Author:        Jakob Olsson      <jakob.olsson@iopsys.eu>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA
 */

"use strict";

const WebSocket = require('ws');
const log = require('npmlog')

const UBUS_ERROR_CODES = ["Success", "Invalid command", "Invalid argument", "Method not found", "Not found", "No response", "Permission denied", "Request timed out", "Operation not supported", "Unknown error", "Connection failed"];
const OPEN_WS_TIMEOUT = 5000;
const MAX_ACTIVE_QUERIES = 5;

/**
 * Class for openWRT ubus communication over websocket (communicating with OWSD).
 *
 */

class UbusWebSocket {
  constructor(ip, port, username, password) {
    this._ws = null;
    this._sessionID;
    this._queryID = 0;
    this._initialized = false;
    this._preparedPromises = [];
    this._activeQueryCounter = 0;
    this._preparedQueries = [];
    this._metaObj = {
      jsonrpc: "2.0",
    }

    this._protocol = "ws://";
    this._url = this._protocol + ip + ":" + port;

    this._username = username;
    this._password = password;
  }

  /**
   * init()
   *
   *
   * @public
   */
  init() {
    let hasReturned = false;

    this._ws = new WebSocket(this._url, "ubus-json", {
      origin: this._url,
      host: this._url
    });

    let initSessionObj = {
      method: "call",
      params: [
        "00000000000000000000000000000000",
        "session",
        "login",
        {
          username: this._username,
          password: this._password
        }
      ]
    };

    log.info('object', '', initSessionObj);

    // define local function to dispatch queries in batches
    let queryDispatcher = () => {
      while (this._preparedQueries.length > 0 && this._activeQueryCounter < MAX_ACTIVE_QUERIES) {
        this._activeQueryCounter++;
        this._ws.send(this._preparedQueries.shift(), { mask: false }, error => {
          if (error) {
            this._activeQueryCounter--;
            reject(error);
          }
        });
      }
    }

    let getPromiseById = (id) => {
      let promiseIdx = this._preparedPromises.findIndex((sentPromise) => { return id == sentPromise.id });
      let promise = this._preparedPromises.splice(promiseIdx, 1)[0];

      return promise;
    }

    // define the ubus response handler
    let onUbusRes = (data) => {
      let uCallParser

      try {
        uCallParser = JSON.parse(data);
      } catch {
        let partialJson = data.split("\"id\"")[1];
        let id = (partialJson
          .match(/\d+\.\d+|\d+\b|\d+(?=\w)/g) || [])
          .map(function (v) { return +v; }).shift();
        let promise = getPromiseById(id);

        this._activeQueryCounter--;
        if (this._activeQueryCounter <= 0)
          queryDispatcher();

        promise.reject("response is not valid json");
        return;
      }

      let promise = getPromiseById(uCallParser.id);

      if (promise == null)
        promise.reject("inconsistent response from ubus");

      this._activeQueryCounter--;
      if (this._activeQueryCounter <= 0)
        queryDispatcher();

      if (uCallParser.result[0] == 0)
        promise.resolve(uCallParser.result[1]);
      else
        promise.resolve((UBUS_ERROR_CODES[uCallParser.result[0]]));
    }

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!hasReturned) {
          log.info('opening websocket timed out: ');
          reject(Error("could not connect to websocket"));
        }
      }, OPEN_WS_TIMEOUT);

      const ubusObj = Object.assign(this._metaObj, initSessionObj);
      let msg = JSON.stringify(ubusObj);

      log.info('trying to open websocket connection towards CPE');

      this._ws.on('open', () => {
        log.info('connected to CPE');

        if (typeof this._sessionID === 'undefined') {
          this._ws.send(msg, {mask: true}, (error) => {
            if (error)
              reject(error);
          });

          log.info("> ", msg);
        }
      });

      // define method to manage initiation response
      let onConnection = (data) => {
          let uCallParser = JSON.parse(data);

        try {
          this._sessionID = uCallParser.result[1].ubus_rpc_session;
          log.info("sessionID: " + this._sessionID)
        } catch {
          log.error(UBUS_ERROR_CODES[uCallParser.result]);
          this.close();
          reject(UBUS_ERROR_CODES[uCallParser.result]);
        }

        // with socket opened future responses to be managed by onUbusRes
        this._ws.on('message', onUbusRes);

        this._ws.off('message', onConnection);
        this._initialized = true;

        resolve("successfully initiated session");
      }

      this._ws.on('message', onConnection);

      this._ws.addEventListener('error', (err) => {
        log.error(err.message)
        this._initialized = false;

        reject(err);
      });

      this._ws.addEventListener('close', (msg) => {
        log.info("closeEvent, code: " + msg.code);
        this._initialized = false;

        reject(error(msg.code));
      });
    });
  }

  /**
  * close()
  * Close the websocket if it is open.
  *
  * @public
  */
  close() {
    return new Promise((resolve, reject) => {
      if(this._initialized)
        this._ws.close();
      else
        resolve("No socket open!")
      resolve("Socket closed");
    });
  }

  /**
  *
  * sendMessage(command)
  * Promise based send function, sends a ubus formated command, resolve the response as a string
  *
  * @param {command}    example) var command = {method: 'call', params: ['router.wps','checkpin', {pin: '1234'}], expectedResult: {valid: false}};
  *
  * @public
  */
  sendMessage(command) {
    let obj =  {"id": this._queryID};
    const id = this._queryID++;

    return new Promise((resolve, reject) => {
      if (this._initialized === false)
        reject(Error("not ready, perform init"));

      command.params.splice(0, 0, this._sessionID);
      this._metaObj.id = id;
      const ubusObj = Object.assign(this._metaObj, command);
      const msg = JSON.stringify(ubusObj);

      // Store the resolve and reject so the promise can be resolved from elsewhere
      obj.resolve = resolve;
      obj.reject = reject;
      this._preparedPromises.push(obj);
      if (this._activeQueryCounter < MAX_ACTIVE_QUERIES){
        this._activeQueryCounter++;
        this._ws.send(msg, { mask: false }, error => {
          if (error) {
            this._activeQueryCounter--;
            reject(error);
          }
        });
      } else {
        this._preparedQueries.push(msg);
      }
    });
  }
}

module.exports = UbusWebSocket;
