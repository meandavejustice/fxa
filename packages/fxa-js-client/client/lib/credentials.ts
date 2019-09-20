/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

import sjcl, { BitArray } from 'sjcl';
import hkdf from './hkdf';
import pbkdf2 from './pbkdf2';

// Key wrapping and stretching configuration.
const NAMESPACE = 'identity.mozilla.com/picl/v1/';
const PBKDF2_ROUNDS = 1000;
const STRETCHED_PASS_LENGTH_BYTES = 32 * 8;

const HKDF_SALT = sjcl.codec.hex.toBits('00');
const HKDF_LENGTH = 32;

/**
 * Key Wrapping with a name
 */
function kw(name: string): BitArray {
  return sjcl.codec.utf8String.toBits(NAMESPACE + name);
}

/**
 * Key Wrapping with a name and an email
 */
function kwe(name: string, email: string): BitArray {
  return sjcl.codec.utf8String.toBits(NAMESPACE + name + ':' + email);
}

type GeneratedCredentialsResult = {
  authPW: BitArray;
  emailUTF8: string;
  passwordUTF8: string;
  quickStretchedPW: string;
  unwrapBKey: BitArray;
};

/**
 * @class Credentials
 * @constructor
 */
export default class Credentials {
  /**
   * Setup credentials
   * returns A promise that will be fulfilled with `result` of generated credentials
   */
  async setup(
    emailInput: string,
    passwordInput: string
  ): Promise<GeneratedCredentialsResult> {
    const email = kwe('quickStretch', emailInput);
    const password = sjcl.codec.utf8String.toBits(passwordInput);

    const quickStretchedPW = await pbkdf2.derive(
      password,
      email,
      PBKDF2_ROUNDS,
      STRETCHED_PASS_LENGTH_BYTES
    );

    const authPW = await hkdf(
      quickStretchedPW,
      kw('authPW'),
      HKDF_SALT,
      HKDF_LENGTH
    );

    const unwrapBKey = await hkdf(
      quickStretchedPW,
      kw('unwrapBkey'),
      HKDF_SALT,
      HKDF_LENGTH
    );

    return {
      authPW,
      emailUTF8: emailInput,
      passwordUTF8: passwordInput,
      quickStretchedPW,
      unwrapBKey,
    };
  }
  /**
   * Wrap result of the two bitArrays
   */
  xor(bitArray1: BitArray, bitArray2: BitArray): BitArray {
    var result = [];

    for (var i = 0; i < bitArray1.length; i++) {
      result[i] = bitArray1[i] ^ bitArray2[i];
    }

    return result;
  }
  /**
   * Unbundle the WrapKB
   */
  unbundleKeyFetchResponse(key: string, bundle: string): any {
    var self = this;
    var bitBundle = sjcl.codec.hex.toBits(bundle);

    return this.deriveBundleKeys(key, 'account/keys').then(function(keys) {
      var ciphertext = sjcl.bitArray.bitSlice(bitBundle, 0, 8 * 64);
      var expectedHmac = sjcl.bitArray.bitSlice(bitBundle, 8 * -32);
      var hmac = new sjcl.misc.hmac(keys.hmacKey, sjcl.hash.sha256);
      hmac.update(ciphertext);

      if (!sjcl.bitArray.equal(hmac.digest(), expectedHmac)) {
        throw new Error('Bad HMac');
      }

      var keyAWrapB = self.xor(
        sjcl.bitArray.bitSlice(bitBundle, 0, 8 * 64),
        keys.xorKey
      );

      return {
        kA: sjcl.codec.hex.fromBits(
          sjcl.bitArray.bitSlice(keyAWrapB, 0, 8 * 32)
        ),
        wrapKB: sjcl.codec.hex.fromBits(
          sjcl.bitArray.bitSlice(keyAWrapB, 8 * 32)
        ),
      };
    });
  }
  /**
   * Derive the HMAC and XOR keys required to encrypt a given size of payload.
   * @param {String} key Hex Bundle Key
   * @param {String} keyInfo Bundle Key Info
   * @returns {Object} hmacKey, xorKey
   */
  deriveBundleKeys(key: string, keyInfo: string): Object {
    var bitKeyInfo = kw(keyInfo);
    var salt = sjcl.codec.hex.toBits('');
    const keyToBits = sjcl.codec.hex.toBits(key);

    return new hkdf(keyToBits, bitKeyInfo, salt, 3 * 32).then(function(
      keyMaterial
    ) {
      return {
        hmacKey: sjcl.bitArray.bitSlice(keyMaterial, 0, 8 * 32),
        xorKey: sjcl.bitArray.bitSlice(keyMaterial, 8 * 32),
      };
    });
  }
}
