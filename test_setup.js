
import {vi, expect } from 'vitest';
import * as matchers from 'jest-extended';
expect.extend(matchers);

import ResizeObserver from 'resize-observer-polyfill';

vi.stubGlobal('ResizeObserver', ResizeObserver)
