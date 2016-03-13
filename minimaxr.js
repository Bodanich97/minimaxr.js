'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = exports.QUIESCENCE_EXTENSION_DEPTH = exports.MAX_POSITION_VALUE = exports.MIN_POSITION_VALUE = exports.MIN_ANALYSIS_CACHE_DEPTH = exports.ANALYSIS_CACHE_SIZE = exports.USE_ANALYSIS_CACHE = exports.USE_ALPHA_BETA_PRUNING = exports.USE_QUIESCENCE_SEARCH = exports.MAX_SEARCH_DEPTH = exports.MIN_SEARCH_DEPTH = undefined;

require('babel-polyfill');

var MIN_SEARCH_DEPTH = 5;
var MAX_SEARCH_DEPTH = 9;
var USE_QUIESCENCE_SEARCH = true;
var USE_ALPHA_BETA_PRUNING = true;
var USE_ANALYSIS_CACHE = true;
var ANALYSIS_CACHE_SIZE = 4000;
var MIN_ANALYSIS_CACHE_DEPTH = 3;
var MIN_POSITION_VALUE = -999;
var MAX_POSITION_VALUE = 999;
var QUIESCENCE_EXTENSION_DEPTH = 2;

var NORTH_EAST = 0;
var SOUTH_EAST = 1;
var SOUTH_WEST = 2;
var NORTH_WEST = 3;

function MxAnalysisCache() {
	this.Entries = [];
	this.Cursor = 0;

	this.Get = function (player, depth, position) {
		var _iteratorNormalCompletion = true;
		var _didIteratorError = false;
		var _iteratorError = undefined;

		try {
			for (var _iterator = this.Entries[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
				var entry = _step.value;

				if (entry.Player !== player) continue;
				if (entry.Depth < depth) continue;
				if (!entry.Position.Equals(position)) continue;
				return entry.Analysis;
			}
		} catch (err) {
			_didIteratorError = true;
			_iteratorError = err;
		} finally {
			try {
				if (!_iteratorNormalCompletion && _iterator.return) {
					_iterator.return();
				}
			} finally {
				if (_didIteratorError) {
					throw _iteratorError;
				}
			}
		}

		return null;
	};
	this.Set = function (player, depth, position, analysis) {
		if (this.Cursor >= ANALYSIS_CACHE_SIZE) this.Cursor = 0;
		this.Entries[this.Cursor] = {
			Depth: depth,
			Position: position.Clone(),
			Analysis: analysis
		};
		this.Cursor++;
	};
}
var analysisCache = new MxAnalysisCache();

function MxPositionAnalysis(dynamicValue, staticValue, potentialValue, bestMove) {
	this.DynamicValue = dynamicValue;
	this.StaticValue = staticValue;
	this.PotentialValue = potentialValue;
	this.BestMove = bestMove;
}
function MxPosition() {
	//create the initial board
	this.Nodes = [];
	for (var sq = 0; sq <= 40; sq = NextSquare(sq)) {
		this.Nodes[sq] = 1; //white pawn
	}
	for (var _sq = 40; _sq < 60; _sq = NextSquare(_sq)) {
		this.Nodes[_sq] = 0; //no mans land
	}
	for (var _sq2 = 60; _sq2 < 100; _sq2 = NextSquare(_sq2)) {
		this.Nodes[_sq2] = -1; //black pawns
	}

	this.LegalMovesX = function (player, square, direction, captureMode) {
		try {
			var legalMoves = new Array();
			for (var sq = 0; sq < 100; sq = NextSquare(sq)) {
				var man = this.Nodes[sq];
				if (!(player * man > 0 && (square === sq || square == null))) continue;
				for (var dir = 0; dir < 4; dir++) {
					if (!((IsLegalDirection(player, dir) || IsKing(man) || captureMode) && (direction === dir || direction == null))) continue;
					if (captureMode) {
						var moveSegment = new Array();
						var capture = this.GetCapture(sq, dir);
						var perpendicularContinuationsFound = false;
						var lastLandingSquare = null;
						if (capture == null) continue;
						do {
							perpendicularContinuationsFound = false;
							moveSegment = moveSegment.concat(capture);
							this.ExecuteMove(capture);
							lastLandingSquare = moveSegment[moveSegment.length - 3];
							do {
								var legalContinuations = this.LegalMovesX(player, TerminalSquare(moveSegment), PreviousDirection(dir), true);
								legalContinuations = legalContinuations.concat(this.LegalMovesX(player, TerminalSquare(moveSegment), NextDirection(dir), true));
								var _iteratorNormalCompletion2 = true;
								var _didIteratorError2 = false;
								var _iteratorError2 = undefined;

								try {
									for (var _iterator2 = legalContinuations[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
										var continuation = _step2.value;

										legalMoves[legalMoves.length] = NormalizeMove(moveSegment.concat(continuation));
										perpendicularContinuationsFound = true;
									}
								} catch (err) {
									_didIteratorError2 = true;
									_iteratorError2 = err;
								} finally {
									try {
										if (!_iteratorNormalCompletion2 && _iterator2.return) {
											_iterator2.return();
										}
									} finally {
										if (_didIteratorError2) {
											throw _iteratorError2;
										}
									}
								}
							} while (this.AdvanceTerminalSquare(moveSegment, dir)); //attempts to advance terminal square forward by 1 and re-execute
							capture = this.GetCapture(TerminalSquare(moveSegment), dir);
						} while (capture != null);
						if (!perpendicularContinuationsFound) {
							legalMoves[legalMoves.length] = NormalizeMove(moveSegment);
							while (TerminalSquare(moveSegment) !== lastLandingSquare) {
								var bb = this.AdvanceTerminalSquare(moveSegment, OppositeDirection(dir));
								legalMoves[legalMoves.length] = NormalizeMove(moveSegment);
							}
						}
						this.UndoMove(NormalizeMove(moveSegment));
					} else //non capture mode
						{
							var nextSquare = NextSquare(sq, dir, 1);
							while (this.IsFreeSquare(nextSquare)) {
								legalMoves[legalMoves.length] = NormalizeMove(new Array(sq, man, 0, nextSquare, 0, man));
								if (!IsKing(man)) break;
								nextSquare = NextSquare(nextSquare, dir, 1);
							}
						}
				}
			}
			return legalMoves;
		} catch (err) {
			alert('LegalMovesX Error: ' + err);
		}
	};
	this.LegalMoves = function (player) {
		try {
			var legalMoves = this.LegalMovesX(player, null, null, true);
			if (legalMoves.length === 0) legalMoves = this.LegalMovesX(player, null, null, false);
			return legalMoves;
		} catch (err) {
			alert('Legal Moves generation error: ' + err);
		}
	};
	this.Clone = function () {
		var p = new MxPosition();
		for (var s = 0; s < 100; s = NextSquare(s)) {
			p.Nodes[s] = this.Nodes[s];
		}
		return p;
	};
	this.Equals = function (pos) {
		for (var s = 0; s < 100; s = NextSquare(s)) {
			if (pos.Nodes[s] !== this.Nodes[s]) return false;
		}
		return true;
	};
	this.Analysis = function (player, depth, parentBestValue, parentDepth, untilQuiescent) {
		try {
			var legalMoves = this.LegalMoves(player);
			if (legalMoves.length === 0) return new MxPositionAnalysis(MIN_POSITION_VALUE, MIN_POSITION_VALUE, MIN_POSITION_VALUE, null);
			if (depth >= MIN_ANALYSIS_CACHE_DEPTH && USE_ANALYSIS_CACHE) {
				var cachedAnalysis = analysisCache.Get(player, depth, this);
				if (cachedAnalysis != null) return cachedAnalysis;
			}
			if (depth === 0) {
				if (!(untilQuiescent && parentDepth < MAX_SEARCH_DEPTH && CaptureCount(legalMoves[0]) > 0)) return new MxPositionAnalysis(this.StaticValue(player), this.StaticValue(player), MIN_POSITION_VALUE, legalMoves[0]);else depth = QUIESCENCE_EXTENSION_DEPTH;
			}
			var bestValue = MAX_POSITION_VALUE;
			var bestPotentialValue = MAX_POSITION_VALUE;
			var bestChildMove = null;
			var myPotentialValue = 0;

			var hit = false;
			var _iteratorNormalCompletion3 = true;
			var _didIteratorError3 = false;
			var _iteratorError3 = undefined;

			try {
				for (var _iterator3 = legalMoves[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
					var mv = _step3.value;

					this.ExecuteMove(mv);
					var analysis = this.Analysis(-player, depth - 1, bestValue, parentDepth + 1, untilQuiescent);
					this.UndoMove(mv);
					myPotentialValue += analysis.PotentialValue;

					if (analysis.DynamicValue < bestValue || analysis.DynamicValue === bestValue && analysis.PotentialValue < bestPotentialValue) {
						bestValue = analysis.DynamicValue;
						bestPotentialValue = analysis.PotentialValue;
						bestChildMove = mv;
						hit = true;
					}
					if (-bestValue >= parentBestValue && USE_ALPHA_BETA_PRUNING) break;
				}
			} catch (err) {
				_didIteratorError3 = true;
				_iteratorError3 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion3 && _iterator3.return) {
						_iterator3.return();
					}
				} finally {
					if (_didIteratorError3) {
						throw _iteratorError3;
					}
				}
			}

			if (hit === false) console.log('not hit');

			var myAnalysis = new MxPositionAnalysis(-bestValue, this.StaticValue(player), -myPotentialValue, bestChildMove);
			if (USE_ANALYSIS_CACHE) analysisCache.Set(player, depth, this, myAnalysis);
			return myAnalysis;
		} catch (err) {
			alert('Error performing analysis: ' + err);
		}
	};

	this.ValueProfile = function (player) {
		var valueProfile = new Array();
		for (var d = 0; d < MIN_SEARCH_DEPTH; d++) {
			valueProfile[d] = this.DynamicValue(player, d, MAX_POSITION_VALUE, 0, false);
		}
		valueProfile[MIN_SEARCH_DEPTH] = this.DynamicValue(player, d, MAX_POSITION_VALUE, 0, USE_QUIESCENCE_SEARCH);
		return valueProfile;
	};

	this.IsValidSquare = function (sq) {
		try {
			var ssq = sq.toString();
			if (ssq.length === 1) ssq = '0' + ssq;
			if (ssq.length !== 2) return false;
			var row = parseInt(ssq.charAt(0));
			var col = parseInt(ssq.charAt(1));
			return row % 2 === 0 && col % 2 === 0 || row % 2 === 1 && col % 2 === 1;
		} catch (err) {
			alert('IsValidSquare error: ' + err);
		}
	};
	this.IsFreeSquare = function (sq) {
		return this.IsValidSquare(sq) && this.Nodes[sq] === 0;
	};
	this.ManCount = function (player) {
		var c = 0;
		for (var sq = 0; sq < 100; sq = NextSquare(sq)) {
			if (AreComrades(this.Nodes[sq], player) || player == null) c++;
		}
		return c;
	};
	this.StaticValue = function (player) {
		return this.ManCount(player) - this.ManCount(-player);
	};
	this.GetCapture = function (square, direction) {
		try {
			var mycapture = null;
			var man = this.Nodes[square];
			var nextSquare = NextSquare(square, direction, 1);
			if (IsKing(man)) {
				while (this.IsFreeSquare(nextSquare)) {
					nextSquare = NextSquare(nextSquare, direction, 1);
				}
			}
			var landingSq = NextSquare(nextSquare, direction, 1);
			if (this.Nodes[nextSquare] * man < 0 && this.IsFreeSquare(landingSq)) {
				mycapture = new Array(square, man, 0, nextSquare, this.Nodes[nextSquare], 0, landingSq, 0, man);
			}
			return mycapture;
		} catch (err) {
			alert('GetCapture error' + err);
		}
	};
	this.ExecuteMove = function (move) {
		try {
			for (var x = 0; x < move.length; x += 3) {
				this.Nodes[move[x]] = move[x + 2];
			}
		} catch (err) {
			alert('ExecuteMove Error: ' + err);
		}
	};
	this.UndoMove = function (move) {
		try {
			for (var x = 0; x < move.length; x += 3) {
				this.Nodes[move[x]] = move[x + 1];
			}
		} catch (err) {
			alert('UndoMove Error: ' + err);
		}
	};
	this.AdvanceTerminalSquare = function (move, dir) {
		try {
			var finalMan = move[move.length - 1];
			if (this.Nodes[move[move.length - 3]] !== finalMan) alert('AdvanceTerminalSquare problem');

			if (!IsKing(finalMan)) return false;
			if (this.IsFreeSquare(NextSquare(TerminalSquare(move), dir, 1))) {
				this.Nodes[NextSquare(TerminalSquare(move), dir, 1)] = finalMan;
				this.Nodes[TerminalSquare(move)] = 0;
				move[move.length - 3] = NextSquare(TerminalSquare(move), dir, 1);
				return true;
			} else return false;
		} catch (err) {
			alert('AdvanceTerminalSquare error' + err);
		}
	};
}
function MxGame() {
	this.MoveHistory = [];
	this.Position = new MxPosition();
	this.Turn = -1;

	this.BestMove = function () {
		return this.Position.Analysis(this.Turn, MIN_SEARCH_DEPTH, MAX_POSITION_VALUE, 0, USE_QUIESCENCE_SEARCH).BestMove;
	};

	this.TryAcceptMove = function (startSquare, endSquare) {
		var _iteratorNormalCompletion4 = true;
		var _didIteratorError4 = false;
		var _iteratorError4 = undefined;

		try {
			for (var _iterator4 = this.Position.LegalMoves(this.Turn)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
				var mv = _step4.value;

				if (mv[0] === startSquare && mv[mv.length - 3] === endSquare) {
					this.Position.ExecuteMove(mv);
					this.MoveHistory.push(mv);
					return true;
				}
			}
		} catch (err) {
			_didIteratorError4 = true;
			_iteratorError4 = err;
		} finally {
			try {
				if (!_iteratorNormalCompletion4 && _iterator4.return) {
					_iterator4.return();
				}
			} finally {
				if (_didIteratorError4) {
					throw _iteratorError4;
				}
			}
		}

		return false;
	};
}

function NormalizeMove(move) {
	try {
		var rootMan = move[1];
		var mv = new Array(move[0], move[1], move[2]);
		for (var x = 3; x < move.length - 3; x += 3) {
			if (!AreComrades(rootMan, move[x + 1]) && !AreComrades(rootMan, move[x + 2])) {
				mv[mv.length] = move[x];
				mv[mv.length] = move[x + 1];
				mv[mv.length] = move[x + 2];
			}
		}
		mv[mv.length] = move[move.length - 3];
		mv[mv.length] = move[move.length - 2];
		mv[mv.length] = move[move.length - 1];

		//crown if neccesary
		if (!IsKing(mv[mv.length - 1]) && (rootMan === 1 && mv[mv.length - 3] >= 91 || rootMan === -1 && mv[mv.length - 3] <= 8)) {
			mv[mv.length - 1] = mv[mv.length - 1] * 10;
		}
		return mv;
	} catch (err) {
		alert('Move normalization error: ' + err);
	}
}
function TerminalSquare(move) {
	return move[move.length - 3];
}
function NextSquare(sq, dir, steps) {
	try {
		if (sq == null) sq = 0;
		if (steps == null) steps = 1;
		switch (dir) {
			case NORTH_EAST:
				return sq + 9 * steps;
			case SOUTH_EAST:
				return sq - 11 * steps;
			case SOUTH_WEST:
				return sq - 9 * steps;
			case NORTH_WEST:
				return sq + 11 * steps;
			default:
				{
					switch (sq.toString().charAt(sq.toString().length - 1)) {
						case '8':
							return sq + 3;
						case '9':
							return sq + 1;
						default:
							return sq + 2;
					}
				}
		}
	} catch (err) {
		alert('NextSquare error:' + err);
	}
}

function CaptureCount(move) {
	return move.length / 3 - 2;
}
function IsKing(man) {
	return man * man > 1;
}
function AreComrades(man1, man2) {
	return man1 * man2 > 0;
}
function OppositeDirection(direction) {
	return (direction + 2) % 4;
}
function NextDirection(direction) {
	return (direction + 1) % 4;
}
function PreviousDirection(direction) {
	return OppositeDirection(NextDirection(direction));
}
function IsLegalDirection(player, dir) {
	return player === 1 ? dir === NORTH_EAST || dir === NORTH_WEST : dir === SOUTH_EAST || dir === SOUTH_WEST;
}

exports.MIN_SEARCH_DEPTH = MIN_SEARCH_DEPTH;
exports.MAX_SEARCH_DEPTH = MAX_SEARCH_DEPTH;
exports.USE_QUIESCENCE_SEARCH = USE_QUIESCENCE_SEARCH;
exports.USE_ALPHA_BETA_PRUNING = USE_ALPHA_BETA_PRUNING;
exports.USE_ANALYSIS_CACHE = USE_ANALYSIS_CACHE;
exports.ANALYSIS_CACHE_SIZE = ANALYSIS_CACHE_SIZE;
exports.MIN_ANALYSIS_CACHE_DEPTH = MIN_ANALYSIS_CACHE_DEPTH;
exports.MIN_POSITION_VALUE = MIN_POSITION_VALUE;
exports.MAX_POSITION_VALUE = MAX_POSITION_VALUE;
exports.QUIESCENCE_EXTENSION_DEPTH = QUIESCENCE_EXTENSION_DEPTH;
exports.default = MxGame;
