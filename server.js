import express from 'express'
import cors from 'cors'
import mysql from 'mysql2/promise'

const app = express()
const PORT = process.env.PORT || 3000

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'student_app',
  password: process.env.DB_PASSWORD || 'student123456',
  database: process.env.DB_NAME || 'student_scores',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

const scoreFields = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology', 'politics', 'history', 'geography']
const scienceTotalFields = ['chinese', 'math', 'english', 'physics', 'chemistry', 'biology']
const artsTotalFields = ['chinese', 'math', 'english', 'politics', 'history', 'geography']
const subjectLabels = {
  total: '总分',
  chinese: '语文',
  math: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  politics: '政治',
  history: '历史',
  geography: '地理'
}
const subjectSqlMap = Object.freeze({
  total: 'sr.total',
  chinese: 'sr.chinese',
  math: 'sr.math',
  english: 'sr.english',
  physics: 'sr.physics',
  chemistry: 'sr.chemistry',
  biology: 'sr.biology',
  politics: 'sr.politics',
  history: 'sr.history',
  geography: 'sr.geography'
})
const rankedOrderSqlMap = Object.freeze({
  total: 'total',
  rank_no: 'rank_no',
  subject_rank: 'subject_rank',
  student_no: 'student_no',
  name: 'name',
  class_name: 'class_name',
  chinese: 'chinese',
  math: 'math',
  english: 'english',
  physics: 'physics',
  chemistry: 'chemistry',
  biology: 'biology',
  politics: 'politics',
  history: 'history',
  geography: 'geography'
})
const targetStudentCount = 300
const familyNames = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']
const givenNames = ['明', '芳', '强', '娜', '磊', '静', '敏', '洋', '勇', '艳', '杰', '娟', '涛', '霞', '斌', '超', '怡', '安', '天', '欣']

async function ensureSchema() {
  const [[classColumn]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'class_name'`
  )
  if (!classColumn.count) {
    await pool.query("ALTER TABLE students ADD COLUMN class_name VARCHAR(50) DEFAULT '1班' AFTER gender")
    await pool.query("UPDATE students SET class_name = CONCAT(MOD(id - 1, 4) + 1, '班')")
  } else {
    await pool.query("UPDATE students SET class_name = '1班' WHERE class_name IS NULL OR class_name = ''")
  }

  const [[trackColumn]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'students' AND column_name = 'track_type'`
  )
  if (!trackColumn.count) {
    await pool.query("ALTER TABLE students ADD COLUMN track_type VARCHAR(20) DEFAULT '理科' AFTER class_name")
  }

  await ensureStudentData()
  await ensureScoreData()
  await recalculateAllTotalsAndRanks()
}

async function refreshExamRanks(examId) {
  const [rows] = await pool.query('SELECT id, total FROM score_records WHERE exam_id = ? ORDER BY total DESC, id ASC', [examId])
  for (let i = 0; i < rows.length; i += 1) {
    await pool.query('UPDATE score_records SET rank_no = ? WHERE id = ?', [i + 1, rows[i].id])
  }
}

function totalFieldsForTrack(trackType) {
  return trackType === '文科' ? artsTotalFields : scienceTotalFields
}

function calcTotal(payload, trackType = '理科') {
  return totalFieldsForTrack(trackType).reduce((sum, field) => sum + Number(payload[field] || 0), 0)
}

function classForIndex(index) {
  return `${(index % 4) + 1}班`
}

function trackForClass(className) {
  return className === '4班' ? '文科' : '理科'
}

function randomScore(base, spread = 16) {
  return Math.min(100, Math.max(35, base + Math.floor(Math.random() * (spread * 2 + 1)) - spread))
}

function makeScorePayload(trackType) {
  const base = Math.floor(Math.random() * 34) + 58
  const payload = {
    chinese: randomScore(base + 2),
    math: randomScore(base + (trackType === '理科' ? 6 : -2)),
    english: randomScore(base + 1),
    physics: randomScore(base + (trackType === '理科' ? 7 : -5)),
    chemistry: randomScore(base + (trackType === '理科' ? 5 : -4)),
    biology: randomScore(base + (trackType === '理科' ? 4 : -2)),
    politics: randomScore(base + (trackType === '文科' ? 7 : -3)),
    history: randomScore(base + (trackType === '文科' ? 6 : -4)),
    geography: randomScore(base + (trackType === '文科' ? 5 : -2))
  }
  payload.total = calcTotal(payload, trackType)
  return payload
}

async function recalculateAllTotalsAndRanks() {
  await pool.query(`
    UPDATE score_records sr
    JOIN students s ON s.id = sr.student_id
    SET sr.total = CASE
      WHEN s.track_type = '文科' THEN sr.chinese + sr.math + sr.english + sr.politics + sr.history + sr.geography
      ELSE sr.chinese + sr.math + sr.english + sr.physics + sr.chemistry + sr.biology
    END
  `)
  const [exams] = await pool.query('SELECT id FROM exams ORDER BY id ASC')
  for (const exam of exams) {
    await refreshExamRanks(exam.id)
  }
}

function makeStudentName(index) {
  const family = familyNames[index % familyNames.length]
  const first = givenNames[(index * 7) % givenNames.length]
  const second = givenNames[(index * 11 + 3) % givenNames.length]
  return `${family}${first}${second}`
}

async function ensureStudentData() {
  const [students] = await pool.query('SELECT id, student_no FROM students ORDER BY student_no ASC')
  for (let i = 0; i < students.length; i += 1) {
    const className = classForIndex(i)
    await pool.query('UPDATE students SET class_name = ?, track_type = ? WHERE id = ?', [className, trackForClass(className), students[i].id])
  }

  const missing = targetStudentCount - students.length
  if (missing <= 0) return

  const [[maxRow]] = await pool.query('SELECT MAX(CAST(student_no AS UNSIGNED)) AS max_no FROM students')
  let nextNo = Number(maxRow.max_no || 2026000) + 1
  for (let i = students.length; i < targetStudentCount; i += 1) {
    const className = classForIndex(i)
    const trackType = trackForClass(className)
    const gender = i % 2 === 0 ? '男' : '女'
    await pool.query(
      'INSERT INTO students (student_no, name, gender, class_name, track_type, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [String(nextNo), makeStudentName(i), gender, className, trackType, `13${String(100000000 + i).slice(1)}`]
    )
    nextNo += 1
  }
}

async function ensureScoreData() {
  const [exams] = await pool.query('SELECT id FROM exams ORDER BY id ASC')
  if (!exams.length) return

  const [students] = await pool.query('SELECT id, track_type FROM students ORDER BY student_no ASC LIMIT ?', [targetStudentCount])
  for (const exam of exams) {
    for (const student of students) {
      const [[existing]] = await pool.query('SELECT id FROM score_records WHERE student_id = ? AND exam_id = ? LIMIT 1', [student.id, exam.id])
      if (existing) continue

      const payload = makeScorePayload(student.track_type)
      await pool.query(
        `INSERT INTO score_records (student_id, exam_id, chinese, math, english, physics, chemistry, biology, politics, history, geography, total, rank_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [student.id, exam.id, payload.chinese, payload.math, payload.english, payload.physics, payload.chemistry, payload.biology, payload.politics, payload.history, payload.geography, payload.total]
      )
    }
    await refreshExamRanks(exam.id)
  }
}

function getSubject(subject) {
  return subject === 'total' || scoreFields.includes(subject) ? subject : 'total'
}

function getSubjectSql(subject) {
  return subjectSqlMap[getSubject(subject)]
}

function getRankedOrderSql(sortBy) {
  return rankedOrderSqlMap[sortBy] || rankedOrderSqlMap.total
}

function getSortOrder(sortOrder) {
  return String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
}

function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1)
  const rawPageSize = Number.parseInt(query.pageSize, 10) || 10
  const pageSize = [10, 20, 50, 100].includes(rawPageSize) ? rawPageSize : 10
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  }
}

function buildScoreFilters(query) {
  const keyword = String(query.keyword || '').trim()
  const examId = String(query.examId || '').trim()
  const className = String(query.className || '').trim()
  const trackType = String(query.trackType || '').trim()
  const conditions = []
  const values = []

  if (keyword) {
    conditions.push('(s.name LIKE ? OR s.student_no LIKE ? OR s.phone LIKE ?)')
    values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }
  if (examId) {
    conditions.push('e.id = ?')
    values.push(examId)
  }
  if (className) {
    conditions.push('s.class_name = ?')
    values.push(className)
  }
  if (trackType) {
    conditions.push('s.track_type = ?')
    values.push(trackType)
  }

  return {
    whereSql: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    values
  }
}

app.use(cors())
app.use(express.json())

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok')
    res.json({ ok: true, db: rows[0]?.ok === 1 })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const subject = getSubject(req.query.subject)
    const subjectSql = getSubjectSql(subject)
    const excellentLine = subject === 'total' ? 540 : 90
    const goodLine = subject === 'total' ? 480 : 80
    const passLine = subject === 'total' ? 360 : 60
    const { whereSql, values } = buildScoreFilters(req.query)
    const [[studentStat]] = await pool.query('SELECT COUNT(*) AS count FROM students')
    const [trackStats] = await pool.query('SELECT track_type, COUNT(*) AS count FROM students GROUP BY track_type ORDER BY track_type DESC')
    const [[examStat]] = await pool.query('SELECT COUNT(*) AS count FROM exams')
    const recordStatSql = [
      'SELECT COUNT(*) AS count, ROUND(AVG(' + subjectSql + '), 0) AS avg_total',
      'FROM score_records sr',
      'JOIN students s ON s.id = sr.student_id',
      'JOIN exams e ON e.id = sr.exam_id',
      whereSql
    ].join('\n')
    const [[recordStat]] = await pool.query(recordStatSql, values)

    const distributionSql = [
      'SELECT',
      'SUM(CASE WHEN ' + subjectSql + ' >= ? THEN 1 ELSE 0 END) AS excellent,',
      'SUM(CASE WHEN ' + subjectSql + ' >= ? AND ' + subjectSql + ' < ? THEN 1 ELSE 0 END) AS good,',
      'SUM(CASE WHEN ' + subjectSql + ' >= ? AND ' + subjectSql + ' < ? THEN 1 ELSE 0 END) AS pass,',
      'SUM(CASE WHEN ' + subjectSql + ' < ? THEN 1 ELSE 0 END) AS fail',
      'FROM score_records sr',
      'JOIN students s ON s.id = sr.student_id',
      'JOIN exams e ON e.id = sr.exam_id',
      whereSql
    ].join('\n')
    const [distributionRows] = await pool.query(distributionSql, [excellentLine, goodLine, excellentLine, passLine, goodLine, passLine, ...values])
    const distribution = distributionRows[0] || {}

    const classStatsSql = [
      'SELECT class_name, track_type, record_count, avg_score,',
      'RANK() OVER (ORDER BY avg_score DESC, class_name ASC) AS rank_no',
      'FROM (',
      'SELECT s.class_name, MIN(s.track_type) AS track_type, COUNT(*) AS record_count, ROUND(AVG(' + subjectSql + '), 0) AS avg_score',
      'FROM score_records sr',
      'JOIN students s ON s.id = sr.student_id',
      'JOIN exams e ON e.id = sr.exam_id',
      whereSql,
      'GROUP BY s.class_name',
      ') class_summary',
      'ORDER BY rank_no ASC, class_name ASC'
    ].join('\n')
    const [classStats] = await pool.query(classStatsSql, values)

    const topScoresSql = [
      'SELECT *',
      'FROM (',
      'SELECT sr.id AS score_id, s.student_no, s.name, s.class_name, s.track_type, e.exam_name, ' + subjectSql + ' AS subject_score, sr.total,',
      'RANK() OVER (ORDER BY sr.total DESC, sr.id ASC) AS rank_no,',
      'RANK() OVER (ORDER BY ' + subjectSql + ' DESC, sr.id ASC) AS subject_rank',
      'FROM score_records sr',
      'JOIN students s ON s.id = sr.student_id',
      'JOIN exams e ON e.id = sr.exam_id',
      whereSql,
      ') ranked',
      'ORDER BY subject_score DESC, score_id ASC',
      'LIMIT 10'
    ].join('\n')
    const [topScores] = await pool.query(topScoresSql, values)
    res.json({
      studentCount: studentStat.count,
      examCount: examStat.count,
      recordCount: recordStat.count,
      avgTotal: recordStat.avg_total || 0,
      trackStats,
      classStats,
      subject,
      subjectLabel: subjectLabels[subject],
      distribution: {
        excellent: Number(distribution.excellent || 0),
        good: Number(distribution.good || 0),
        pass: Number(distribution.pass || 0),
        fail: Number(distribution.fail || 0)
      },
      topScores
    })
  } catch (error) {
    res.status(500).json({ message: '获取仪表盘失败', error: error.message })
  }
})

app.get('/api/students', async (req, res) => {
  try {
    const { page, pageSize, offset } = getPagination(req.query)
    const className = String(req.query.className || '').trim()
    const trackType = String(req.query.trackType || '').trim()
    const conditions = []
    const values = []
    if (className) {
      conditions.push('class_name = ?')
      values.push(className)
    }
    if (trackType) {
      conditions.push('track_type = ?')
      values.push(trackType)
    }
    const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const [[countRow]] = await pool.query(['SELECT COUNT(*) AS total FROM students', whereSql].join('\n'), values)
    const [items] = await pool.query(['SELECT * FROM students', whereSql, 'ORDER BY student_no ASC LIMIT ? OFFSET ?'].join('\n'), [...values, pageSize, offset])
    res.json({ items, total: countRow.total, page, pageSize })
  } catch (error) {
    res.status(500).json({ message: '获取学生列表失败', error: error.message })
  }
})

app.get('/api/classes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL AND class_name <> "" ORDER BY class_name ASC')
    res.json(rows.map(row => row.class_name))
  } catch (error) {
    res.status(500).json({ message: '获取班级列表失败', error: error.message })
  }
})

app.get('/api/tracks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT track_type FROM students WHERE track_type IS NOT NULL AND track_type <> "" ORDER BY track_type DESC')
    res.json(rows.map(row => row.track_type))
  } catch (error) {
    res.status(500).json({ message: '获取文理科列表失败', error: error.message })
  }
})

app.get('/api/exams', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM exams ORDER BY id ASC')
    res.json(rows)
  } catch (error) {
    res.status(500).json({ message: '获取考试列表失败', error: error.message })
  }
})

app.post('/api/exams', async (req, res) => {
  try {
    const exam_name = String(req.body.exam_name || '').trim()
    const exam_type = String(req.body.exam_type || '').trim()
    const grade_name = String(req.body.grade_name || '高一').trim()
    const class_name = String(req.body.class_name || '1班').trim()
    if (!exam_name || !exam_type) return res.status(400).json({ message: '考试名称和类型不能为空' })
    const [result] = await pool.query('INSERT INTO exams (exam_name, exam_type, grade_name, class_name) VALUES (?, ?, ?, ?)', [exam_name, exam_type, grade_name, class_name])
    const [students] = await pool.query('SELECT id, track_type FROM students ORDER BY id ASC')
    for (const student of students) {
      const payload = makeScorePayload(student.track_type)
      await pool.query(
        `INSERT INTO score_records (student_id, exam_id, chinese, math, english, physics, chemistry, biology, politics, history, geography, total, rank_no)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [student.id, result.insertId, payload.chinese, payload.math, payload.english, payload.physics, payload.chemistry, payload.biology, payload.politics, payload.history, payload.geography, payload.total]
      )
    }
    await refreshExamRanks(result.insertId)
    const [rows] = await pool.query('SELECT * FROM exams WHERE id = ?', [result.insertId])
    res.status(201).json(rows[0])
  } catch (error) {
    res.status(500).json({ message: '新增考试失败', error: error.message })
  }
})

app.get('/api/score-records', async (req, res) => {
  try {
    const { page, pageSize, offset } = getPagination(req.query)
    const orderSql = getRankedOrderSql(req.query.sortBy)
    const sortOrder = getSortOrder(req.query.sortOrder)
    const subject = getSubject(req.query.subject)
    const subjectSql = getSubjectSql(subject)
    const { whereSql, values } = buildScoreFilters(req.query)

    const countSql = [
      'SELECT COUNT(*) AS total',
      'FROM score_records sr',
      'JOIN students s ON s.id = sr.student_id',
      'JOIN exams e ON e.id = sr.exam_id',
      whereSql
    ].join('\n')
    const [[countRow]] = await pool.query(countSql, values)

    const recordsSql = [
      'SELECT *',
      'FROM (',
      'SELECT sr.id AS score_id, sr.id, sr.student_id, sr.exam_id,',
      'sr.chinese, sr.math, sr.english, sr.physics, sr.chemistry, sr.biology, sr.politics, sr.history, sr.geography,',
      'sr.total, sr.created_at, sr.updated_at,',
      's.student_no, s.name, s.gender, s.class_name, s.track_type, s.phone, e.exam_name, e.exam_type,',
      subjectSql + ' AS subject_score,',
      'RANK() OVER (ORDER BY sr.total DESC, sr.id ASC) AS rank_no,',
      'RANK() OVER (ORDER BY ' + subjectSql + ' DESC, sr.id ASC) AS subject_rank',
      'FROM score_records sr',
      'JOIN students s ON s.id = sr.student_id',
      'JOIN exams e ON e.id = sr.exam_id',
      whereSql,
      ') ranked',
      'ORDER BY ' + orderSql + ' ' + sortOrder + ', score_id ASC',
      'LIMIT ? OFFSET ?'
    ].join('\n')
    const [items] = await pool.query(recordsSql, [...values, pageSize, offset])

    res.json({ items, total: countRow.total, page, pageSize, subject, subjectLabel: subjectLabels[subject] })
  } catch (error) {
    res.status(500).json({ message: '获取成绩记录失败', error: error.message })
  }
})

app.post('/api/score-records', async (req, res) => {
  try {
    const payload = req.body
    const [[student]] = await pool.query('SELECT track_type FROM students WHERE id = ?', [payload.student_id])
    if (!student) return res.status(400).json({ message: '学生不存在' })
    const total = calcTotal(payload, student.track_type)
    const [result] = await pool.query(
      `INSERT INTO score_records (student_id, exam_id, chinese, math, english, physics, chemistry, biology, politics, history, geography, total, rank_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [payload.student_id, payload.exam_id, payload.chinese, payload.math, payload.english, payload.physics, payload.chemistry, payload.biology, payload.politics, payload.history, payload.geography, total]
    )
    await refreshExamRanks(payload.exam_id)
    res.status(201).json({ message: '成绩录入成功', id: result.insertId })
  } catch (error) {
    res.status(500).json({ message: '成绩录入失败', error: error.message })
  }
})

app.put('/api/score-records/:id', async (req, res) => {
  try {
    const payload = req.body
    const [[record]] = await pool.query(
      `SELECT sr.exam_id, s.track_type
       FROM score_records sr
       JOIN students s ON s.id = sr.student_id
       WHERE sr.id = ?`,
      [req.params.id]
    )
    if (!record) return res.status(404).json({ message: '成绩记录不存在' })
    const total = calcTotal(payload, record.track_type)
    const [result] = await pool.query(
      `UPDATE score_records
       SET chinese = ?, math = ?, english = ?, physics = ?, chemistry = ?, biology = ?, politics = ?, history = ?, geography = ?, total = ?
       WHERE id = ?`,
      [payload.chinese, payload.math, payload.english, payload.physics, payload.chemistry, payload.biology, payload.politics, payload.history, payload.geography, total, req.params.id]
    )
    if (!result.affectedRows) return res.status(404).json({ message: '成绩记录不存在' })
    await refreshExamRanks(record.exam_id)
    res.json({ message: '成绩修改成功' })
  } catch (error) {
    res.status(500).json({ message: '成绩修改失败', error: error.message })
  }
})

app.get('/api/score-records/export', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.student_no, s.name, s.gender, s.class_name, s.track_type, s.phone, e.exam_name, sr.chinese, sr.math, sr.english, sr.physics, sr.chemistry, sr.biology, sr.politics, sr.history, sr.geography, sr.total, sr.rank_no
      FROM score_records sr
      JOIN students s ON s.id = sr.student_id
      JOIN exams e ON e.id = sr.exam_id
      ORDER BY sr.total DESC, sr.id ASC
    `)
    const headers = ['学号','姓名','性别','班级','文理科','电话','考试','语文','数学','英语','物理','化学','生物','政治','历史','地理','总分','排名']
    const csv = ['\uFEFF' + headers.join(',')].concat(rows.map(row => [row.student_no,row.name,row.gender,row.class_name,row.track_type,row.phone,row.exam_name,row.chinese,row.math,row.english,row.physics,row.chemistry,row.biology,row.politics,row.history,row.geography,row.total,row.rank_no].map(v => `"${String(v)}"`).join(','))).join('\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.send(csv)
  } catch (error) {
    res.status(500).json({ message: '导出失败', error: error.message })
  }
})

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Express API running at http://0.0.0.0:${PORT}`)
    })
  })
  .catch(error => {
    console.error('Failed to initialize database schema:', error)
    process.exit(1)
  })
