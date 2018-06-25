'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
/**
 * Helper to batch queries on mongoose
 *
 */
function indexResults(results, indexField, cacheKeyFn = (key) => key) {
  const indexedResults = new Map();
  results.forEach((res) => {
    indexedResults.set(cacheKeyFn(res[indexField]), res);
  });
  return indexedResults;
}

function normalizeResults(keys, indexField, cacheKeyFn = (key) => key) {
  return (results) => {
    const indexedResults = indexResults(results, indexField, cacheKeyFn);
    // $FlowFixMe
    return keys.map(
      (val) => indexedResults.get(cacheKeyFn(val)) || new Error(`Key not found : ${val}`),
    );
  };
}

const cacheKeyFn = (exports.cacheKeyFn = (key) => key.toString());

// TODO add types to mongoose

exports.default = async (model, ids) => {
  const results = await model.find({ _id: { $in: ids } });
  return normalizeResults(ids, '_id', cacheKeyFn)(results);
};
