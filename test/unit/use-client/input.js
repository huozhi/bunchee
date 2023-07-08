'use strict';

import client from './client'

'use client'; // this should be ignored it didn't appear at the top of the file

export default () => {
  return client()
}
