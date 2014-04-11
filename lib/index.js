/**
 * Simple MySQL Model
 *
 * @author 老雷<leizongmin@gmail.com>
 */

var assert = require('assert');
var async = require('async');
var debug = require('debug')('lei-mysql-model');


function notLeiMySQLInstance (method) {
  return new TypeError('Model.' + method + '(): connection is not a lei-mysql instance.\n' +
    'More information for lei-mysql, see https://npmjs.org/package/lei-mysql\n');
}

function isType (value, type) {
  switch (type) {
    case '*':
      return true;
    case 'string':
      return (typeof value === 'string' && value.length > 0);
    case 'number':
      return (!isNaN(value));
    case 'date':
      return (typeof value === 'string' && isFinite(new Date(value)));
    default:
      return false;
  }
}

function FieldNotExistsError (field) {
  var err = new TypeError('Field "' + field + '" does not exists');
  err.field = field;
  return err;
}

function InvalidFieldValueError (field, value) {
  var err = new TypeError('Invalid value "' + value + '"(' + (typeof value) + ') of field "' + field + '"');
  err.field = field;
  err.value = value;
  return err;
}

function MissingRequiredFieldError (field) {
  var err = new TypeError('Missing required field "' + field + '"');
  err.field = field;
  return err;
}

function defaultFormatMethod (data, callback) {
  callback(null, data);
}

function getHumName (str) {
  return str.toLowerCase().split(/_+/).map(function (a) {
    return a[0].toUpperCase() + a.slice(1);
  }).join('');
}

function cloneObject (obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Model
 *
 * @param {Object} options
 *   - {Object} connection MySQL数据库连接(lei-mysql实例)
 *   - {String} table   表名
 *   - {String} primary 主键
 *   - {Number} limit   默认返回数量
 *   - {Object} fields  字段对应的验证函数
 *   - {Array} queryFields 快速查询的字段
 *   - {Array} requiredFields 添加记录时必填的字段
 *   - {Function} input  用于预处理输入一行数据的异步函数
 *   - {Function} output 用于预处理输出一行数据的异步函数
 *
 * 数据验证顺序：
 *   format input --> valid fields --> check required fields
*      --> query --> format output
 */
function Model (options) {
  var me = this;
  assert(typeof options.connection !== 'undefined', 'Missing option "connection"');
  var conn = options.connection;
  assert(typeof conn.query === 'function', 'MySQL connection must provided a query() method');
  assert(typeof conn.escapeId === 'function', 'MySQL connection must provided a escapeId() method');
  assert(typeof conn.escape === 'function', 'MySQL connection must provided a escape() method');
  options = options || {};
  assert(typeof options.table === 'string', 'Missing option "table"');
  me.connection = conn;
  me._table = options.table || 'undefined';
  me._primary = options.primary || 'id';
  me._limit = options.limit > 0 ? Number(options.limit) : 20;

  // 字段验证函数
  assert(options.fields && typeof options.fields === 'object', 'Missing option "fields"');
  me._fields = options.fields;
  Object.keys(me._fields).forEach(function (i) {
    var p = me._fields[i];
    var t = typeof p;
    assert(t === 'string' || t === 'function' || (p instanceof RegExp),
           'Each field of fields option must be string, RegExp or function');
    if (t === 'string') {
      me._fields[i] = function (v) {
        return isType(v, p);
      };
    } else if (p instanceof RegExp) {
      me._fields[i] = function (v) {
        return p.test(v);
      };
    }
  });

  // 输入输出格式化
  if (typeof options.input === 'function') {
    me.formatInput = options.input;
  } else {
    me.formatInput = defaultFormatMethod;
  }
  if (typeof options.output === 'function') {
    me.formatOutput = options.output;
  } else {
    me.formatOutput = defaultFormatMethod;
  }

  // 快速操作
  if (!Array.isArray(options.queryFields)) options.queryFields = [];
  options.queryFields.push(me._primary);
  options.queryFields.forEach(function (f) {
    var n = getHumName(f);
    function makeQuery (f, v) {
      var q = {};
      q[f] = v;
      return q;
    }
    me['getBy' + n] = function (v, callback) {
      if (v === undefined) return callback(this.missingRequiredFieldError(f));
      this.get(makeQuery(f, v), callback);
    };
    me['listBy' + n] = function (v, opts, callback) {
      if (v === undefined) return callback(this.missingRequiredFieldError(f));
      this.list(makeQuery(f, v), opts, callback);
    };
    me['countBy' + n] = function (v, callback) {
      if (v === undefined) return callback(this.missingRequiredFieldError(f));
      this.count(makeQuery(f, v), callback);
    };
    me['updateBy' + n] = function (v, data, callback) {
      if (v === undefined) return callback(this.missingRequiredFieldError(f));
      this.update(makeQuery(f, v), data, callback);
    };
    me['deleteBy' + n] = function (v, callback) {
      if (v === undefined) return callback(this.missingRequiredFieldError(f));
      this.delete(makeQuery(f, v), callback);
    };
    me['incrBy' + n] = function (v, field, value, callback) {
      if (v === undefined) return callback(this.missingRequiredFieldError(f));
      this.incr(makeQuery(f, v), field, value, callback);
    };
  });

  // 必填字段
  if (Array.isArray(options.requiredFields)) {
    me._requiredFields = options.requiredFields;
  } else {
    me._requiredFields = [];
  }
}

/**
 * 验证字段数据是否正确
 *
 * @param {String} field
 * @param {Mixed} value
 * @return {Boolean}
 */
Model.prototype.valid = function (field, value) {
  var valid = this._fields[field];
  if (!valid) throw this.fieldNotExistsError(field);
  return valid(value);
};

/**
 * 获得有效字段的数据
 *
 * @param {Object} data
 * @return {Object}
 */
Model.prototype.filterData = function (data) {
  var ret = {};
  for (var i in data) {
    if (i in this._fields) {
      ret[i] = data[i];
    }
  }
  return ret;
};

/**
 * 检查各字段数据是否合法，出错返回数组，成功返回null
 *
 * @param {Object} data
 * @return {null|Array}
 */
Model.prototype.validData = function (data) {
  var ret = [];
  for (var i in data) {
    try {
      var ok = this.valid(i, data[i]);
    } catch (err) {
      ret.push(err);
    }
    if (!ok) {
      ret.push(this.invalidFieldValueError(i, data[i]));
    }
  }
  return (ret.length > 0 ? ret : null);
};

/**
 * 字段不存在错误
 *
 * @param {String} field
 * @return {Error}
 */
Model.prototype.fieldNotExistsError = function (field) {
  return new FieldNotExistsError(field);
};

/**
 * 不正确的字段值
 *
 * @param {String} field
 * @param {Mixed} value
 * @return {Error}
 */
Model.prototype.invalidFieldValueError = function (field, value) {
  return new InvalidFieldValueError(field, value);
};

/**
 * 缺少字段参数
 *
 * @param {String} field
 * @return {Error}
 */
Model.prototype.missingRequiredFieldError = function (field) {
  return new MissingRequiredFieldError(field);
};

/**
 * 查询
 *
 * @param {Object} query
 * @param {Function} callback
 */
Model.prototype.get = function (query, callback) {
  query = cloneObject(query);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('get'));
  }

  debug('%s.get()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(query, next, 'get');
    },

    function (query, next) {
      query = me.filterData(query);
      var err = me.validData(query);
      if (err) return next(err);

      me.connection.findOne(me._table, query, function (err, data) {
        next(err, data);
      });
    },

    function (data, next) {
      me.formatOutput(data, next);
    }

  ], callback);
};

/**
 * 列表
 *
 * @param {Object} query
 * @param {Object} options
 *   - {Array} order    排序方式：['id', 'asc']
 *   - {Number} limit   返回结果数量
 *   - {Number} offset  起始位置
 * @param {Function} callback
 */
Model.prototype.list = function (query, options, callback) {
  query = cloneObject(query);
  options = cloneObject(options);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('list'));
  }
  if (arguments.length < 3) {
    callback = options;
    options = {};
  }

  debug('%s.list()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(query, next, 'list');
    },

    function (query, next) {
      query = me.filterData(query);
      var err = me.validData(query);
      if (err) return next(err);

      if (typeof query === 'object' && Object.keys(query).length < 1) {
        query = 1;
      }

      var db = me.connection;
      var tail = '';
      if (Array.isArray(options.order)) {
        tail += ' ORDER BY ' + options.order.map(function (item) {
          return db.escapeId(item[0]) + ' ' + (String(item[1]).toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
        }).join(', ');
      }
      if (!(options.offset > 0)) options.offset = 0;
      if (!(options.limit > 0)) options.limit = options.limit = me._limit;
      tail += ' LIMIT ' + Number(options.offset) + ', ' + Number(options.limit);
      me.connection.find(me._table, query, {tail: tail}, function (err, data) {
        next(err, data);
      });
    },

    function (data, next) {
      async.mapSeries(data, function (data, next) {
        me.formatOutput(data, next);
      }, next);
    }

  ], callback);
};

/**
 * 数量
 *
 * @param {Object} query
 * @param {Function} callback
 */
Model.prototype.count = function (query, callback) {
  query = cloneObject(query);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('count'));
  }

  debug('%s.count()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(query, next, 'count');
    },

    function (query, next) {
      query = me.filterData(query);
      var err = me.validData(query);
      if (err) return next(err);

      if (typeof query === 'object' && Object.keys(query).length < 1) {
        query = 1;
      }

      var db = me.connection;
      me.connection.findOne(me._table, query, {fields: 'COUNT(*) AS `c`'}, function (err, data) {
        next(err, data);
      });
    },

    function (data, next) {
      next(null, data.c);
    }

  ], callback);
};

/**
 * 添加记录
 *
 * @param {Object} data
 * @param {Function} callback
 */
Model.prototype.add = function (data, callback) {
  data = cloneObject(data);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('add'));
  }

  debug('%s.add()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(data, next, 'add');
    },

    function (data, next) {
      data = me.filterData(data);
      var err = me.validData(data);
      if (err) return next(err);

      // 检查必填字段
      var errList = [];
      for (var i = 0; i < me._requiredFields.length; i++) {
        var f = me._requiredFields[i];
        if (f in data) {
          continue;
        } else {
          errList.push(me.missingRequiredFieldError(f));
        }
      }
      if (errList.length > 0) return next(errList);

      me.connection.insert(me._table, data, function (err, info) {
        next(err, info && info.insertId);
      });
    }

  ], callback);
};

/**
 * 更新记录
 *
 * @param {Object} query
 * @param {Object} data
 * @param {Function} callback
 */
Model.prototype.update = function (query, data, callback) {
  query = cloneObject(query);
  data = cloneObject(data);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('update'));
  }

  debug('%s.update()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(query, function (err, ret) {
        query = ret;
        next(err);
      }, 'update1');
    },

    function (next) {
      me.formatInput(data, function (err, ret) {
        data = ret;
        next(err);
      }, 'update2');
    },

    function (next) {
      query = me.filterData(query);
      var err = me.validData(query);
      if (err) return next(err);

      data = me.filterData(data);
      var err = me.validData(data);
      if (err) return next(err);

      me.connection.update(me._table, query, data, function (err, info) {
        next(err, info && info.affectedRows);
      });
    }

  ], callback);
};

/**
 * 增加某个字段的值
 *
 * @param {Object} query
 * @param {String} field
 * @param {Number} value
 * @param {Function} callback
 */
Model.prototype.incr = function (query, field, value, callback) {
  query = cloneObject(query);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('query'));
  }

  debug('%s.incr()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(query, next, 'update1');
    },

    function (query, next) {
      query = me.filterData(query);
      var err = me.validData(query);
      if (err) return next(err);

      var data = {};
      data[field] = ['$incr', value];

      me.connection.update(me._table, query, data, function (err, info) {
        next(err, info && info.affectedRows);
      });
    }

  ], callback);
};

/**
 * 删除记录
 *
 * @param {Object} query
 * @param {Function} callback
 */
Model.prototype.delete = function (query, callback) {
  query = cloneObject(query);
  var me = this;
  if (typeof me.connection.findOne !== 'function') {
    return callback(notLeiMySQLInstance('query'));
  }

  debug('%s.delete()', me._table);

  async.waterfall([

    function (next) {
      me.formatInput(query, next, 'delete');
    },

    function (query, next) {
      query = me.filterData(query);
      var err = me.validData(query);
      if (err) return next(err);

      me.connection.delete(me._table, query, function (err, info) {
        next(err, info && info.affectedRows);
      });
    }

  ], callback);
};

/**
 * 格式化list查询中的options参数
 *
 * @param {Object} options
 *   - {String} order    排序方式：id:asc,created_at:desc
 *   - {Number} limit   返回结果数量
 *   - {Number} offset  起始位置
 * @return {Object}
 */
Model.prototype.formatListOptions = function (options) {
  var me = this;
  var ret = {};
  ret.limit = (options.limit > 0 ? Number(options.limit) : 10);
  ret.offset = (options.offset > 0 ? Number(options.offset) : 0);
  if (typeof options.order === 'string' && options.order.length > 0) {
    ret.order = options.order.split(',').map(function (s) {
      return s.split(':');
    }).filter(function (s) {
      return (s.length === 2 && s[0] in me._fields);
    });
  }
  if (!(ret.order && ret.order.length > 0)) {
    ret.order = [['id', 'asc']];
  }
  return ret;
};

/**
 * 当前时间戳
 *
 * @return {Number}
 */
Model.prototype.timestamp = function () {
  return Math.round(Date.now() / 1000);
};


/**
 * 创建数据模型
 *
 * @param {Object} options
 * @return {Object}
 */
Model.create = function (options) {
  return new Model(options);
};

/**
 * 扩展数据模型
 *
 * @param {Object} options
 * @return {Object}
 */
Model.extend = function (options) {
  var base = Model.create(options);
  var m = {base: base};
  Object.keys(Model.prototype).concat(Object.keys(base)).forEach(function (i) {
    if (typeof base[i] !== 'function') return;
    m[i] = function () {
      return base[i].apply(base, arguments);
    };
  });
  return m;
};

// 错误对象
Model.FieldNotExistsError = FieldNotExistsError;
Model.isFieldNotExistsError = function (err) {
  return (err instanceof FieldNotExistsError);
};
Model.InvalidFieldValueError = InvalidFieldValueError;
Model.isInvalidFieldValueError = function (err) {
  return (err instanceof InvalidFieldValueError);
};
Model.MissingRequiredFieldError = MissingRequiredFieldError;
Model.isMissingRequiredFieldError = function (err) {
  return (err instanceof MissingRequiredFieldError);
};


// 输出
exports = module.exports = Model;
