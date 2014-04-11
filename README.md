lei-mysql-model
=======

使用方法：

```javascript
var MySQLPool = require('lei-mysql');
var MySQLModel = require('lei-mysql-model');


// 创建数据库连接（必须用lei-mysql模块）
var pool = new MySQLPool({
  host:     '127.0.0.1',
  port:     3306,
  database: 'test',
  user:     'root',
  password: '12345'
  pool:     10
});


var model = MySQLModel.create({
  connection: pool,
  table: '数据表名称',
  primary: '主键',
  limit: '默认list返回数量',
  fields: {
    '字段名': '类型，可选string, number, *, 或通过函数来返回布尔值'
  },
  queryFields: ['快速查询的字段'],
  requiredFields: ['添加记录时必填的字段'],
  input: function (query, callback, type) { // 格式化输入
    // query 是输入的参数
    // callback(null, query); 返回修改后的参数
    // type 是当前输入类型
    //    add-添加, update-更新时的查询参数, update2-更新时的数据参数
    //    get-查询一条记录时的查询参数, list-查询列表时的查询参数
  },
  output: function (item, callback) { // 格式化输出，仅get或list时
    // item 是每行结果
    // callback(null, item); 返回修改后的结果
  }
});
```

**自用的东西，可能会随时改动，不建议使用，如果非要使用，一定要指定版本号**

详细使用方法请查看测试文件：https://github.com/leizongmin/node-lei-mysql-model/blob/master/test/test.js

本模块依赖 [lei-mysql](https://github.com/leizongmin/node-lei-mysql)


License
========

```
Copyright (c) 2013-2014 Zongmin Lei (雷宗民) <leizongmin@gmail.com>
http://ucdok.com

The MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```