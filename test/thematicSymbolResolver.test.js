import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getFeatureThematicValues,
  resolveFeatureSymbol,
  resolveThematicFieldSymbol,
  thematicRangeMatches
} from '../src/thematic/thematicSymbolResolver.js';

const base = {
  iconType: 'circle',
  radius: 10,
  color: '#0070c0',
  fillColor: '#92cddc',
  weight: 1,
  opacity: 1,
  fillOpacity: 1,
  fill: true,
  stroke: true
};

test('ordinary layer symbol is returned when there is no active thematic map', () => {
  const ordinary = { color: '#111', radius: 6 };
  assert.equal(resolveFeatureSymbol({ properties: {} }, { symbol: ordinary, thematic: [] }), ordinary);
});

test('active thematic base replaces ordinary layer symbol and matching fields merge sequential overrides', () => {
  const feature = {
    properties: {
      thematic: {
        '12:133': { 101: '10443' },
        '12:1160': { 102: '20000000' }
      }
    }
  };
  const style = {
    symbol: { color: '#00b050', radius: 15 },
    thematic: [{
      active: true,
      symbol: base,
      fields: [
        { code: '12:133', ranges: [{ value: '10443', symbol: { iconType: 'iconfont', iconFont: 'ui-icon-star', color: '#ff0000' } }] },
        { code: '12:1160', ranges: [{ value: '15200000<>22600000', symbol: { iconSize: [15, 15] } }] }
      ]
    }]
  };

  assert.deepEqual(resolveFeatureSymbol(feature, style), {
    ...base,
    iconType: 'iconfont',
    iconFont: 'ui-icon-star',
    color: '#ff0000',
    iconSize: [15, 15]
  });
});

test('any thematic multivalue may match and first configured matching range wins', () => {
  const feature = { properties: { thematic: { '12:133': { 1: 'x', 2: 'b' } } } };
  const field = {
    code: '12:133',
    ranges: [
      { value: 'a,b,c', symbol: { color: 'first' } },
      { value: 'b', symbol: { color: 'second' } }
    ]
  };
  assert.deepEqual(getFeatureThematicValues(feature, field.code), ['x', 'b']);
  assert.deepEqual(resolveThematicFieldSymbol(feature, field), { color: 'first' });
});

test('numeric interval matching is inclusive and accepts numeric strings', () => {
  const range = { value: '400000<>7800000' };
  assert.equal(thematicRangeMatches('400000', range), true);
  assert.equal(thematicRangeMatches(7800000, range), true);
  assert.equal(thematicRangeMatches('7800001', range), false);
});

test('pre-parsed arrays and min/max ranges are supported', () => {
  assert.equal(thematicRangeMatches('2', { value: ['1', '2', '3'] }), true);
  assert.equal(thematicRangeMatches('m', { min: 'a', max: 'z' }), true);
});

test('rec_GeoField is read locally and does not require thematic API details', () => {
  const feature = { properties: { rec_GeoField: '999' } };
  const field = { code: 'rec_GeoField', ranges: [{ value: '999', symbol: { weight: 7 } }] };
  assert.deepEqual(resolveThematicFieldSymbol(feature, field), { weight: 7 });
});
