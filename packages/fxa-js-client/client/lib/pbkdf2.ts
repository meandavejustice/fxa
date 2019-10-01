/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

import sjcl, { BitArray } from 'sjcl';

/**
 * @class pbkdf2
 * @constructor
 */
export default {
  /**
   * @method derive
   * @param  {bitArray} input The password hex buffer.
   * @param  {bitArray} salt The salt string buffer.
   * @return {int} iterations the derived key bit array.
   */
  derive: function(
    input: BitArray,
    salt: BitArray,
    iterations: number,
    len: number
  ): Promise<any> {
    var result = sjcl.misc.pbkdf2(input, salt, iterations, len, sjcl.misc.hmac);
    return Promise.resolve(result);
  },
};
