'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.getPageInfo = getPageInfo;
const PREFIX = (exports.PREFIX = 'mongo:');

const base64 = (exports.base64 = (str) => Buffer.from(str, 'ascii').toString('base64'));
const unbase64 = (exports.unbase64 = (b64) => Buffer.from(b64, 'base64').toString('ascii'));

/**
 * Rederives the offset from the cursor string
 */
const cursorToOffset = (exports.cursorToOffset = (cursor) =>
  parseInt(unbase64(cursor).substring(PREFIX.length), 10));

/**
 * Given an optional cursor and a default offset, returns the offset to use;
 * if the cursor contains a valid offset, that will be used, otherwise it will
 * be the default.
 */
const getOffsetWithDefault = (exports.getOffsetWithDefault = (cursor, defaultOffset) => {
  if (cursor === undefined || cursor === null) {
    return defaultOffset;
  }
  const offset = cursorToOffset(cursor);
  return isNaN(offset) ? defaultOffset : offset;
});

/**
 * Creates the cursor string from an offset.
 */
const offsetToCursor = (exports.offsetToCursor = (offset) => base64(PREFIX + offset));

const getTotalCount = (exports.getTotalCount = async ({ cursor }) => {
  const clonedCursor = cursor.model.find().merge(cursor);

  return await clonedCursor.count();
});

const calculateOffsets = (exports.calculateOffsets = ({ args, totalCount }) => {
  const { after, before } = args;
  let { first, last } = args;

  // Limit the maximum number of elements in a query
  if (!first && !last) first = 10;
  if (first && first > 1000) first = 1000;
  if (last && last > 1000) last = 1000;

  const beforeOffset = getOffsetWithDefault(before, totalCount);
  const afterOffset = getOffsetWithDefault(after, -1);

  let startOffset = Math.max(-1, afterOffset) + 1;
  let endOffset = Math.min(totalCount, beforeOffset);

  if (first !== undefined) {
    endOffset = Math.min(endOffset, startOffset + first);
  }

  if (last !== undefined) {
    startOffset = Math.max(startOffset, endOffset - (last || 0));
  }

  const skip = Math.max(startOffset, 0);

  const limit = endOffset - startOffset;

  return {
    first,
    last,
    before,
    after,
    skip,
    limit,
    beforeOffset,
    afterOffset,
    startOffset,
    endOffset,
    startCursorOffset: skip,
    endCursorOffset: limit + skip,
  };
});

function getPageInfo({
  edges,
  // before,
  // after,
  // first,
  // last,
  // afterOffset,
  // beforeOffset,
  // startOffset,
  // endOffset,
  totalCount,
  startCursorOffset,
  endCursorOffset,
}) {
  const firstEdge = edges[0];
  const lastEdge = edges[edges.length - 1];

  // const lowerBound = after ? afterOffset + 1 : 0;
  // const upperBound = before ? Math.min(beforeOffset, totalCount) : totalCount;

  return {
    startCursor: firstEdge ? firstEdge.cursor : null,
    endCursor: lastEdge ? lastEdge.cursor : null,
    hasPreviousPage: startCursorOffset > 0,
    hasNextPage: endCursorOffset < totalCount,
    // hasPreviousPage: last !== null ? startOffset > lowerBound : false,
    // hasNextPage: first !== null ? endOffset < upperBound : false,
  };
}

async function connectionFromMongoCursor({ cursor, context, args = {}, loader, raw = false }) {
  const clonedCursor = cursor.model.find().merge(cursor);

  const totalCount = await getTotalCount({
    cursor: clonedCursor,
  });

  const {
    first,
    last,
    before,
    after,
    skip,
    limit,
    beforeOffset,
    afterOffset,
    startOffset,
    endOffset,
    startCursorOffset,
    endCursorOffset,
  } = calculateOffsets({ args, totalCount });

  // If supplied slice is too large, trim it down before mapping over it.
  clonedCursor.skip(skip);
  clonedCursor.limit(limit);

  // avoid large objects retrieval from collection
  const slice = await clonedCursor.select(raw ? {} : { _id: 1 }).exec();

  const edges = slice.map((value, index) => ({
    cursor: offsetToCursor(startOffset + index),
    node: loader(context, raw ? value : value._id),
  }));

  return {
    edges,
    count: totalCount,
    endCursorOffset,
    startCursorOffset,
    pageInfo: getPageInfo({
      edges,
      before,
      after,
      first,
      last,
      afterOffset,
      beforeOffset,
      startOffset,
      endOffset,
      totalCount,
      startCursorOffset,
      endCursorOffset,
    }),
  };
}

exports.default = connectionFromMongoCursor;
