/**
 * Copyright (C) 2021 Thomas Weber
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import './import-first';

import React from 'react';

import Interface from './render-interface.jsx';
import render from './app-target';

// FORK: pick the AprismWarp work type from the URL query (D-10)
const aprismwarpWorkType = new URLSearchParams(window.location.search).get('workType');
if (aprismwarpWorkType) {
    window.APRISMWARP_WORK_TYPE = aprismwarpWorkType;
}

render(<Interface />);
