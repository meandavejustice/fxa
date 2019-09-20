/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

import sjcl, { bitArray } from 'sjcl';
import hkdf from './hkdf';

const PREFIX_NAME = 'identity.mozilla.com/picl/v1/';
const bitSlice = sjcl.bitArray.bitSlice;
const salt = sjcl.codec.hex.toBits('');

/**
 * @class hawkCredentials
 * @method deriveHawkCredentials
 * @param {String} tokenHex
 * @param {String} context
 * @param {int} size
 * @returns {Promise}
 */
export default async function deriveHawkCredentials(
  tokenHex: string,
  context: string,
  size: number
): Promise<any> {
  var token = sjcl.codec.hex.toBits(tokenHex);
  var info = sjcl.codec.utf8String.toBits(PREFIX_NAME + context);

  const out = await hkdf(token, info, salt, size || 3 * 32);
  var authKey = bitSlice(out, 8 * 32, 8 * 64);
  var bundleKey = bitSlice(out, 8 * 64);
  return {
    algorithm: 'sha256',
    id: sjcl.codec.hex.fromBits(bitSlice(out, 0, 8 * 32)),
    key: authKey,
    bundleKey: bundleKey,
  };
}
