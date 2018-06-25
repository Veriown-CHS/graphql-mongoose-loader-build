'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});

var _ConnectionFromMongoCursor = require('./ConnectionFromMongoCursor');

const cloneAggregate = (aggregate) => aggregate._model.aggregate(aggregate.pipeline());

/**
 * Your aggregate must return documents with _id fields
 *  those _id's are the ones going to be passed to the loader function
 */
async function connectionFromMongoAggregate({
  aggregate,
  context,
  args = {},
  loader,
  raw = false,
}) {
  // https://github.com/Automattic/mongoose/blob/367261e6c83e7e367cf0d3fbd2edea4c64bf1ee2/lib/aggregate.js#L46
  const clonedAggregate = cloneAggregate(aggregate);

  const resultCount = await cloneAggregate(aggregate).count('total');
  const totalCount = resultCount.length ? resultCount[0].total : 0;

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
  } = (0, _ConnectionFromMongoCursor.calculateOffsets)({ args, totalCount });

  // If supplied slice is too large, trim it down before mapping over it.
  clonedAggregate.skip(skip);
  // limit should never be 0 because $slice returns an error if it is.
  clonedAggregate.limit(limit || 1);

  // avoid large objects retrieval from collection
  const slice = await (raw ? clonedAggregate : clonedAggregate.project('_id'));

  const edges = slice.map((value, index) => ({
    cursor: (0, _ConnectionFromMongoCursor.offsetToCursor)(startOffset + index),
    node: loader(context, raw ? value : value._id),
  }));

  return {
    edges,
    count: totalCount,
    endCursorOffset,
    startCursorOffset,
    pageInfo: (0, _ConnectionFromMongoCursor.getPageInfo)({
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

exports.default = connectionFromMongoAggregate;
