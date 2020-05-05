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

 "use strict"

const wsUBUS = require('..');
const WS_IP = "192.168.1.1";
const WS_PORT = 80;

const WS_USER_NAME = "admin";
const WS_PASSWORD = "admin";

(async() => {
   const communicator = new wsUBUS(WS_IP, WS_PORT, WS_USER_NAME, WS_PASSWORD);


   try {
      await communicator.init();

      var command = {
         method: 'call',
         params: [
            'juci.network',
            'online', {}
         ],
         expectedResult: {
            valid: true
         }
      };

      await communicator.sendMessage(command)
        .then(response => {
            console.log("successful -- response:\n", response);
        })
        .catch(err => {
          console.log("failure -- response:\n", err);
        });

      process.exit();
   } catch (e) {
      console.log(e);
   }

})();
