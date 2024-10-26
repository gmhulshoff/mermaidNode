const { Connection, Request } = require('tedious')
const { readFileSync, existsSync } = require('fs')

function connect(db, src, onready) {
  const connection = new Connection(JSON.parse(readFileSync('./mermaid/config.json')))
  const execute = (connection, onready, source, sql, parameters = []) => {
    const request = new Request(sql, err => { if (err) console.log(err) })
    parameters.forEach(p => request.addParameter(p.name, p.type, p.value))
    var rows = []
    request.on('row', cols => rows.push(cols.map(c => c.value)))
    request.on('done', (rowCount, more) => console.log(rowCount + ' rows returned'))
    request.on('requestCompleted', (rowCount, more) => {connection.close();onready(rows)})
    connection.execSql(request)
  }
  const fname = './mermaid/' + src
  const sql = `USE ${db};${existsSync(fname) ? readFileSync(fname) : src}`
  connection.on('connect', err => execute(connection, onready, `${db}:${src}`, sql))
  connection.connect()
}

module.exports = { connect }

