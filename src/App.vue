<template>
  <div class="app-shell">
    <header class="header-bar">
      <div class="brand-area">
        <span class="brand-mark">SWU</span>
        <div>
          <p class="eyebrow">Student Management</p>
          <h1>学生信息管理系统</h1>
        </div>
      </div>
      <nav class="top-nav" :data-active="currentPage" aria-label="主导航">
        <button class="nav-link" :class="{ active: currentPage === 'dashboard' }" @click="switchPage('dashboard')">成绩总览</button>
        <button class="nav-link" :class="{ active: currentPage === 'student-maintain' }" @click="switchPage('student-maintain')">学生维护</button>
        <button class="nav-link" :class="{ active: currentPage === 'grade-manage' }" @click="switchPage('grade-manage')">成绩管理</button>
      </nav>
    </header>

    <main class="page-body">
      <template v-if="currentPage === 'dashboard'">
        <section class="overview-shell">
          <section class="overview-top">
            <div class="overview-title">
              <p class="eyebrow">Overview</p>
              <h2>成绩总览</h2>
              <p>按考试、班级、文理科和科目筛选，查看对应方向的完整成绩与排名。</p>
            </div>
            <div class="filter-bar">
              <select v-model="query.examId" @change="resetPageAndFetch">
                <option value="">全部考试</option>
                <option v-for="exam in examList" :key="exam.id" :value="exam.id">{{ exam.exam_name }}</option>
              </select>
              <select v-model="query.className" @change="resetPageAndFetch">
                <option value="">全部班级</option>
                <option v-for="className in classList" :key="className" :value="className">{{ className }}</option>
              </select>
              <select v-model="query.trackType" @change="resetPageAndFetch">
                <option value="">全部文理科</option>
                <option v-for="track in trackList" :key="track" :value="track">{{ track }}</option>
              </select>
              <select v-model="query.subject" @change="applySubject">
                <option v-for="field in subjectOptions" :key="field.key" :value="field.key">{{ field.label }}</option>
              </select>
              <select v-model.number="pageSize" @change="resetPageAndFetch">
                <option :value="10">10 条/页</option>
                <option :value="20">20 条/页</option>
                <option :value="50">50 条/页</option>
              </select>
              <button class="primary-btn" @click="resetPageAndFetch">查询</button>
            </div>
          </section>

          <section class="overview-grid">
            <div class="summary-card">
              <p class="eyebrow">Population</p>
              <h3>人数情况</h3>
              <div class="summary-metrics">
                <span><strong>{{ dashboardSummary.studentCount }}</strong>学生</span>
                <span><strong>{{ scienceCount }}</strong>理科</span>
                <span><strong>{{ artsCount }}</strong>文科</span>
              </div>
            </div>
            <div class="summary-card">
              <p class="eyebrow">Average</p>
              <h3>平均分情况</h3>
              <div class="summary-metrics">
                <span><strong>{{ dashboardSummary.avgTotal }}</strong>{{ currentSubjectLabel }}</span>
                <span><strong>{{ dashboardSummary.recordCount }}</strong>记录</span>
              </div>
            </div>
            <div class="summary-card">
              <p class="eyebrow">Classes</p>
              <h3>班级情况</h3>
              <div class="class-rank-list">
                <div v-for="item in dashboardSummary.classStats" :key="item.class_name" class="class-rank-row">
                  <span class="class-rank-no">{{ item.rank_no }}</span>
                  <strong>{{ item.class_name }}</strong>
                  <em>{{ item.track_type }}</em>
                  <b>{{ item.avg_score }}</b>
                </div>
              </div>
            </div>
            <div class="chart-card bar-card">
              <div class="section-head tight-head">
                <div>
                  <p class="eyebrow">Bar Chart</p>
                  <h3>等级人数</h3>
                </div>
              </div>
              <div class="bar-chart">
                <div v-for="item in distributionItems" :key="item.key" class="bar-item">
                  <span>{{ item.label }}</span>
                  <div class="bar-track"><i :style="{ width: item.percent + '%', background: item.color }"></i></div>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
            <div class="chart-card donut-card">
              <div class="section-head tight-head">
                <div>
                  <p class="eyebrow">Ratio</p>
                  <h3>成绩占比</h3>
                </div>
              </div>
              <div class="donut-wrap">
                <div class="donut" :style="{ background: donutBackground }">
                  <div><strong>{{ passRate }}%</strong><span>及格率</span></div>
                </div>
                <div class="legend-list">
                  <span v-for="item in distributionItems" :key="item.key"><i :style="{ background: item.color }"></i>{{ item.label }} {{ item.percent }}%</span>
                </div>
              </div>
            </div>
          </section>

          <section class="panel-card compact-card">
            <div class="section-head">
              <div>
                <p class="eyebrow">Ranking</p>
                <h3>全部学生成绩排名</h3>
              </div>
              <input v-model="query.keyword" class="search-input" placeholder="姓名 / 学号 / 电话" @keyup.enter="resetPageAndFetch" />
            </div>
            <div class="score-table-shell">
              <table class="data-table rank-table">
                <thead>
                  <tr>
                    <th>学号</th><th>姓名</th><th>班级</th><th>文理科</th><th>排名</th><th>单科排名</th><th>{{ currentSubjectLabel }}</th><th>总分</th><th v-for="field in visibleScoreFields" :key="field.key">{{ field.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in gradeRecords" :key="item.score_id">
                    <td>{{ item.student_no }}</td>
                    <td class="strong-cell">{{ item.name }}</td>
                    <td>{{ item.class_name }}</td>
                    <td><span class="track-pill" :class="{ arts: item.track_type === '文科' }">{{ item.track_type }}</span></td>
                    <td><span class="rank-badge">{{ item.rank_no }}</span></td>
                    <td><span class="rank-badge subject-rank">{{ item.subject_rank }}</span></td>
                    <td><span class="score-pill">{{ item.subject_score }}</span></td>
                    <td>{{ item.total }}</td>
                    <td v-for="field in visibleScoreFields" :key="field.key">{{ item[field.key] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pagination">
              <button @click="changePage(page - 1)" :disabled="page <= 1">上一页</button>
              <span>第 {{ page }} 页 / 共 {{ recordPageCount }} 页，共 {{ recordTotal }} 条</span>
              <button @click="changePage(page + 1)" :disabled="page >= recordPageCount">下一页</button>
            </div>
          </section>
        </section>
      </template>

      <template v-else-if="currentPage === 'student-maintain'">
        <section class="manage-layout">
          <aside class="side-menu">
            <p class="eyebrow">Menu</p>
            <div class="menu-title">学生档案</div>
            <button class="side-item active">信息维护</button>
          </aside>

          <section class="content-panel">
            <section class="hero-panel compact-hero">
              <div>
                <p class="eyebrow">Students</p>
                <h2>学生信息维护</h2>
                <p>学生基础信息以查看为主，新增班级信息用于成绩筛选和排名统计。</p>
              </div>
            </section>

            <section class="panel-card">
              <div class="section-head">
                <div>
                  <p class="eyebrow">Records</p>
                  <h3>学生列表</h3>
                </div>
                <div class="toolbar-row">
                  <select v-model="query.className" @change="resetPageAndFetch">
                    <option value="">全部班级</option>
                    <option v-for="className in classList" :key="className" :value="className">{{ className }}</option>
                  </select>
                  <select v-model="query.trackType" @change="resetPageAndFetch">
                    <option value="">全部文理科</option>
                    <option v-for="track in trackList" :key="track" :value="track">{{ track }}</option>
                  </select>
                  <select v-model.number="pageSize" @change="resetPageAndFetch">
                    <option :value="10">10 条/页</option>
                    <option :value="20">20 条/页</option>
                    <option :value="50">50 条/页</option>
                  </select>
                </div>
              </div>

              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr><th>操作</th><th>学号</th><th>姓名</th><th>性别</th><th>班级</th><th>文理科</th><th>电话</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="student in studentList" :key="student.id">
                      <td><button class="table-btn" @click="openStudentModal(student)">查看资料</button></td>
                      <td>{{ student.student_no }}</td>
                      <td class="strong-cell">{{ student.name }}</td>
                      <td>{{ student.gender }}</td>
                      <td>{{ student.class_name }}</td>
                      <td><span class="track-pill" :class="{ arts: student.track_type === '文科' }">{{ student.track_type }}</span></td>
                      <td>{{ student.phone }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="pagination">
                <button @click="changePage(page - 1)" :disabled="page <= 1">上一页</button>
                <span>第 {{ page }} 页 / 共 {{ studentPageCount }} 页</span>
                <button @click="changePage(page + 1)" :disabled="page >= studentPageCount">下一页</button>
              </div>
            </section>
          </section>
        </section>
      </template>

      <template v-else>
        <section class="manage-layout">
          <aside class="side-menu">
            <p class="eyebrow">Grade Center</p>
            <div class="menu-title">成绩管理</div>
            <button v-for="tab in gradeTabs" :key="tab.key" class="side-item" :class="{ active: gradeTab === tab.key }" @click="gradeTab = tab.key">
              {{ tab.label }}
            </button>
          </aside>

          <section class="content-panel">
            <template v-if="gradeTab === 'overview'">
              <section class="overview-shell">
                <section class="overview-top slim-top">
                  <div class="overview-title">
                    <p class="eyebrow">Overview</p>
                    <h2>成绩总览</h2>
                    <p>筛选考试、班级、文理科与科目后查看分页排名和分布图表。</p>
                  </div>
                  <div class="filter-bar">
                    <select v-model="query.examId" @change="resetPageAndFetch">
                      <option value="">全部考试</option>
                      <option v-for="exam in examList" :key="exam.id" :value="exam.id">{{ exam.exam_name }}</option>
                    </select>
                    <select v-model="query.className" @change="resetPageAndFetch">
                      <option value="">全部班级</option>
                      <option v-for="className in classList" :key="className" :value="className">{{ className }}</option>
                    </select>
                    <select v-model="query.trackType" @change="resetPageAndFetch">
                      <option value="">全部文理科</option>
                      <option v-for="track in trackList" :key="track" :value="track">{{ track }}</option>
                    </select>
                    <select v-model="query.subject" @change="applySubject">
                      <option v-for="field in subjectOptions" :key="field.key" :value="field.key">{{ field.label }}</option>
                    </select>
                    <button class="primary-btn" @click="resetPageAndFetch">查询</button>
                  </div>
                </section>
                <section class="overview-grid compact-overview-grid">
                  <div class="summary-card">
                    <p class="eyebrow">Population</p>
                    <h3>人数情况</h3>
                    <div class="summary-metrics">
                      <span><strong>{{ dashboardSummary.studentCount }}</strong>学生</span>
                      <span><strong>{{ scienceCount }}</strong>理科</span>
                      <span><strong>{{ artsCount }}</strong>文科</span>
                    </div>
                  </div>
                  <div class="summary-card">
                    <p class="eyebrow">Average</p>
                    <h3>平均分情况</h3>
                    <div class="summary-metrics">
                      <span><strong>{{ dashboardSummary.avgTotal }}</strong>{{ currentSubjectLabel }}</span>
                      <span><strong>{{ dashboardSummary.recordCount }}</strong>记录</span>
                    </div>
                  </div>
                  <div class="summary-card">
                    <p class="eyebrow">Classes</p>
                    <h3>班级情况</h3>
                    <div class="class-rank-list">
                      <div v-for="item in dashboardSummary.classStats" :key="item.class_name" class="class-rank-row">
                        <span class="class-rank-no">{{ item.rank_no }}</span>
                        <strong>{{ item.class_name }}</strong>
                        <em>{{ item.track_type }}</em>
                        <b>{{ item.avg_score }}</b>
                      </div>
                    </div>
                  </div>
                  <div class="chart-card bar-card">
                    <h3>等级人数</h3>
                    <div class="bar-chart">
                      <div v-for="item in distributionItems" :key="item.key" class="bar-item">
                        <span>{{ item.label }}</span><div class="bar-track"><i :style="{ width: item.percent + '%', background: item.color }"></i></div><strong>{{ item.value }}</strong>
                      </div>
                    </div>
                  </div>
                  <div class="chart-card donut-card">
                    <h3>占比</h3>
                    <div class="donut-wrap small-donut">
                      <div class="donut" :style="{ background: donutBackground }"><div><strong>{{ passRate }}%</strong><span>及格率</span></div></div>
                      <div class="legend-list">
                        <span v-for="item in distributionItems" :key="item.key"><i :style="{ background: item.color }"></i>{{ item.label }} {{ item.percent }}%</span>
                      </div>
                    </div>
                  </div>
                </section>
                <section class="panel-card compact-card">
                  <div class="section-head">
                    <div>
                      <p class="eyebrow">Ranking</p>
                      <h3>分页成绩排名</h3>
                    </div>
                    <select v-model.number="pageSize" @change="resetPageAndFetch">
                      <option :value="10">10 条/页</option>
                      <option :value="20">20 条/页</option>
                      <option :value="50">50 条/页</option>
                    </select>
                  </div>
                  <div class="score-table-shell">
                    <table class="data-table rank-table">
                      <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>文理科</th><th>排名</th><th>单科排名</th><th>{{ currentSubjectLabel }}</th><th>总分</th><th v-for="field in visibleScoreFields" :key="field.key">{{ field.label }}</th></tr></thead>
                      <tbody>
                        <tr v-for="item in gradeRecords" :key="item.score_id">
                          <td>{{ item.student_no }}</td><td class="strong-cell">{{ item.name }}</td><td>{{ item.class_name }}</td><td><span class="track-pill" :class="{ arts: item.track_type === '文科' }">{{ item.track_type }}</span></td><td><span class="rank-badge">{{ item.rank_no }}</span></td><td><span class="rank-badge subject-rank">{{ item.subject_rank }}</span></td><td><span class="score-pill">{{ item.subject_score }}</span></td><td>{{ item.total }}</td><td v-for="field in visibleScoreFields" :key="field.key">{{ item[field.key] }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="pagination">
                    <button @click="changePage(page - 1)" :disabled="page <= 1">上一页</button>
                    <span>第 {{ page }} 页 / 共 {{ recordPageCount }} 页，共 {{ recordTotal }} 条</span>
                    <button @click="changePage(page + 1)" :disabled="page >= recordPageCount">下一页</button>
                  </div>
                </section>
              </section>
            </template>

            <template v-else-if="gradeTab === 'import'">
              <section class="hero-panel compact-hero">
                <div>
                  <p class="eyebrow">Import</p>
                  <h2>成绩录入</h2>
                  <p>为指定学生和考试新增完整科目成绩记录。</p>
                </div>
              </section>

              <section class="panel-card">
                <div class="form-grid">
                  <label>
                    <span>学生</span>
                    <select v-model="importForm.student_id">
                      <option value="">选择学生</option>
                      <option v-for="student in allStudents" :key="student.id" :value="student.id">{{ student.student_no }} - {{ student.name }} - {{ student.class_name }} - {{ student.track_type }}</option>
                    </select>
                  </label>
                  <label>
                    <span>考试</span>
                    <select v-model="importForm.exam_id">
                      <option value="">选择考试</option>
                      <option v-for="exam in examList" :key="exam.id" :value="exam.id">{{ exam.exam_name }}</option>
                    </select>
                  </label>
                  <label v-for="field in scoreFields" :key="field.key">
                    <span>{{ field.label }}</span>
                    <input v-model.number="importForm[field.key]" type="number" min="0" max="100" />
                  </label>
                </div>
                <div class="action-row">
                  <button class="primary-btn" @click="submitImport">提交录入</button>
                </div>
              </section>
            </template>

            <template v-else-if="gradeTab === 'edit'">
              <section class="hero-panel compact-hero">
                <div>
                  <p class="eyebrow">Edit</p>
                  <h2>成绩修改</h2>
                  <p>支持筛选成绩记录，并按现有后端逻辑执行示例修改。</p>
                </div>
              </section>

              <section class="panel-card">
                <div class="toolbar-row">
                  <input v-model="query.keyword" placeholder="姓名 / 学号 / 电话" />
                  <select v-model="query.examId">
                    <option value="">全部考试</option>
                    <option v-for="exam in examList" :key="exam.id" :value="exam.id">{{ exam.exam_name }}</option>
                  </select>
                  <select v-model="query.className">
                    <option value="">全部班级</option>
                    <option v-for="className in classList" :key="className" :value="className">{{ className }}</option>
                  </select>
                  <select v-model="query.trackType">
                    <option value="">全部文理科</option>
                    <option v-for="track in trackList" :key="track" :value="track">{{ track }}</option>
                  </select>
                  <button class="primary-btn" @click="resetPageAndFetch">查询</button>
                </div>
                <p class="muted">{{ message }}</p>
              </section>

              <section class="panel-card">
                <div class="table-wrap">
                  <table class="data-table">
                    <thead><tr><th>操作</th><th>班级</th><th>文理科</th><th>学号</th><th>姓名</th><th>考试</th><th>总分</th><th>排名</th><th>语文</th><th>数学</th><th>英语</th></tr></thead>
                    <tbody>
                      <tr v-for="item in gradeRecords" :key="item.score_id">
                        <td><button class="table-btn" @click="boostRecord(item)">示例修改</button></td>
                        <td>{{ item.class_name }}</td>
                        <td><span class="track-pill" :class="{ arts: item.track_type === '文科' }">{{ item.track_type }}</span></td>
                        <td>{{ item.student_no }}</td>
                        <td class="strong-cell">{{ item.name }}</td>
                        <td>{{ item.exam_name }}</td>
                        <td><span class="score-pill">{{ item.total }}</span></td>
                        <td>{{ item.rank_no }}</td>
                        <td>{{ item.chinese }}</td>
                        <td>{{ item.math }}</td>
                        <td>{{ item.english }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="pagination">
                  <button @click="changePage(page - 1)" :disabled="page <= 1">上一页</button>
                  <span>第 {{ page }} 页 / 共 {{ recordPageCount }} 页</span>
                  <button @click="changePage(page + 1)" :disabled="page >= recordPageCount">下一页</button>
                </div>
              </section>
            </template>

            <template v-else>
              <section class="hero-panel compact-hero">
                <div>
                  <p class="eyebrow">Search</p>
                  <h2>成绩查询</h2>
                  <p>按考试、班级、关键字、总分或单科成绩排序查看记录。</p>
                </div>
              </section>

              <section class="panel-card">
                <div class="toolbar-row">
                  <input v-model="query.keyword" placeholder="姓名 / 学号 / 电话" />
                  <select v-model="query.examId">
                    <option value="">全部考试</option>
                    <option v-for="exam in examList" :key="exam.id" :value="exam.id">{{ exam.exam_name }}</option>
                  </select>
                  <select v-model="query.className">
                    <option value="">全部班级</option>
                    <option v-for="className in classList" :key="className" :value="className">{{ className }}</option>
                  </select>
                  <select v-model="query.trackType">
                    <option value="">全部文理科</option>
                    <option v-for="track in trackList" :key="track" :value="track">{{ track }}</option>
                  </select>
                  <select v-model="query.sortBy">
                    <option value="total">总分</option>
                    <option value="subject_rank">单科排名</option>
                    <option value="rank_no">总排名</option>
                    <option value="chinese">语文</option>
                    <option value="math">数学</option>
                    <option value="english">英语</option>
                  </select>
                  <select v-model="query.sortOrder">
                    <option value="desc">降序</option>
                    <option value="asc">升序</option>
                  </select>
                  <button class="primary-btn" @click="resetPageAndFetch">查询</button>
                </div>
              </section>

              <section class="panel-card">
                <div class="table-wrap">
                  <table class="data-table">
                    <thead><tr><th>班级</th><th>文理科</th><th>学号</th><th>姓名</th><th>考试</th><th>总分</th><th>排名</th><th>语文</th><th>数学</th><th>英语</th></tr></thead>
                    <tbody>
                      <tr v-for="item in gradeRecords" :key="item.score_id">
                        <td>{{ item.class_name }}</td>
                        <td><span class="track-pill" :class="{ arts: item.track_type === '文科' }">{{ item.track_type }}</span></td>
                        <td>{{ item.student_no }}</td>
                        <td class="strong-cell">{{ item.name }}</td>
                        <td>{{ item.exam_name }}</td>
                        <td><span class="score-pill">{{ item.total }}</span></td>
                        <td>{{ item.rank_no }}</td>
                        <td>{{ item.chinese }}</td>
                        <td>{{ item.math }}</td>
                        <td>{{ item.english }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="pagination">
                  <button @click="changePage(page - 1)" :disabled="page <= 1">上一页</button>
                  <span>第 {{ page }} 页 / 共 {{ recordPageCount }} 页</span>
                  <button @click="changePage(page + 1)" :disabled="page >= recordPageCount">下一页</button>
                </div>
              </section>
            </template>
          </section>
        </section>
      </template>
    </main>

    <div v-if="studentModalVisible" class="modal-mask" @click.self="closeStudentModal">
      <div class="student-modal">
        <div class="modal-head">
          <div>
            <p class="eyebrow">Profile</p>
            <strong>学生信息</strong>
          </div>
          <button class="close-btn" @click="closeStudentModal">×</button>
        </div>
        <div class="modal-body">
          <div class="modal-form">
            <label>学号</label>
            <input :value="selectedStudent?.student_no || ''" readonly />
            <label>姓名</label>
            <input :value="selectedStudent?.name || ''" readonly />
            <label>性别</label>
            <input :value="selectedStudent?.gender || ''" readonly />
            <label>班级</label>
            <input :value="selectedStudent?.class_name || ''" readonly />
            <label>文理科</label>
            <input :value="selectedStudent?.track_type || ''" readonly />
            <label>电话</label>
            <input :value="selectedStudent?.phone || ''" readonly />
          </div>
          <div class="modal-portrait">
            <div class="portrait-box">{{ selectedStudent?.name?.slice(0, 1) || '生' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'

const API_BASE = '/api'
function pageFromPath(path) {
  if (path === '/student-maintain') return 'student-maintain'
  if (path === '/grade-manage') return 'grade-manage'
  return 'dashboard'
}

const pagePaths = {
  dashboard: '/',
  'student-maintain': '/student-maintain',
  'grade-manage': '/grade-manage'
}
const currentPage = ref(pageFromPath(window.location.pathname))

const gradeTabs = [
  { key: 'overview', label: '成绩总览' },
  { key: 'import', label: '成绩录入' },
  { key: 'edit', label: '成绩修改' },
  { key: 'search', label: '成绩查询' }
]
const scoreFields = [
  { key: 'chinese', label: '语文' },
  { key: 'math', label: '数学' },
  { key: 'english', label: '英语' },
  { key: 'physics', label: '物理' },
  { key: 'chemistry', label: '化学' },
  { key: 'biology', label: '生物' },
  { key: 'politics', label: '政治' },
  { key: 'history', label: '历史' },
  { key: 'geography', label: '地理' }
]
const subjectOptions = [{ key: 'total', label: '全科总分' }, ...scoreFields]
const colors = {
  excellent: '#3e6f55',
  good: '#5f8fbe',
  pass: '#c7863b',
  fail: '#b74e3d'
}

const dashboardSummary = ref({ studentCount: 0, examCount: 0, recordCount: 0, avgTotal: 0, distribution: {}, trackStats: [], classStats: [], topScores: [] })
const studentList = ref([])
const allStudents = ref([])
const examList = ref([])
const classList = ref([])
const trackList = ref([])
const gradeRecords = ref([])
const studentTotal = ref(0)
const recordTotal = ref(0)
const page = ref(1)
const pageSize = ref(10)
const message = ref('')
const gradeTab = ref('overview')
const studentModalVisible = ref(false)
const selectedStudent = ref(null)
const query = reactive({ keyword: '', examId: '', className: '', trackType: '', subject: 'total', sortBy: 'subject_rank', sortOrder: 'asc' })
const importForm = reactive({ student_id: '', exam_id: '', chinese: 60, math: 60, english: 60, physics: 60, chemistry: 60, biology: 60, politics: 60, history: 60, geography: 60 })

const studentPageCount = computed(() => Math.max(Math.ceil(studentTotal.value / pageSize.value), 1))
const recordPageCount = computed(() => Math.max(Math.ceil(recordTotal.value / pageSize.value), 1))
const currentSubjectLabel = computed(() => subjectOptions.find(item => item.key === query.subject)?.label || '全科总分')
const visibleScoreFields = computed(() => {
  const baseFields = scoreFields.filter(field => ['chinese', 'math', 'english'].includes(field.key))
  const scienceFields = scoreFields.filter(field => ['physics', 'chemistry', 'biology'].includes(field.key))
  const artsFields = scoreFields.filter(field => ['history', 'geography', 'politics'].includes(field.key))
  if (query.trackType === '文科') return [...baseFields, ...artsFields]
  return [...baseFields, ...scienceFields]
})
const scienceCount = computed(() => Number(dashboardSummary.value.trackStats?.find(item => item.track_type === '理科')?.count || 0))
const artsCount = computed(() => Number(dashboardSummary.value.trackStats?.find(item => item.track_type === '文科')?.count || 0))
const distributionItems = computed(() => {
  const distribution = dashboardSummary.value.distribution || {}
  const total = Number(distribution.excellent || 0) + Number(distribution.good || 0) + Number(distribution.pass || 0) + Number(distribution.fail || 0)
  return [
    { key: 'excellent', label: '优秀', value: Number(distribution.excellent || 0), color: colors.excellent },
    { key: 'good', label: '良好', value: Number(distribution.good || 0), color: colors.good },
    { key: 'pass', label: '及格', value: Number(distribution.pass || 0), color: colors.pass },
    { key: 'fail', label: '不及格', value: Number(distribution.fail || 0), color: colors.fail }
  ].map(item => ({ ...item, percent: total ? Math.round((item.value / total) * 100) : 0 }))
})
const passRate = computed(() => distributionItems.value.filter(item => item.key !== 'fail').reduce((sum, item) => sum + item.percent, 0))
const donutBackground = computed(() => {
  let cursor = 0
  const segments = distributionItems.value.map(item => {
    const start = cursor
    cursor += item.percent
    return `${item.color} ${start}% ${cursor}%`
  })
  return `conic-gradient(${segments.join(', ') || '#ded5c7 0% 100%'})`
})

function buildQueryParams() {
  return new URLSearchParams({
    page: String(page.value),
    pageSize: String(pageSize.value),
    keyword: query.keyword,
    examId: query.examId,
    className: query.className,
    trackType: query.trackType,
    subject: query.subject,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder
  })
}

async function fetchData() {
  const params = buildQueryParams()
  const summaryParams = new URLSearchParams({
    examId: query.examId,
    className: query.className,
    trackType: query.trackType,
    subject: query.subject
  })
  const studentParams = new URLSearchParams({
    page: String(page.value),
    pageSize: String(pageSize.value),
    className: currentPage.value === 'student-maintain' ? query.className : '',
    trackType: currentPage.value === 'student-maintain' ? query.trackType : ''
  })

  const [summaryRes, examsRes, classesRes, tracksRes, studentsRes, allStudentsRes, recordsRes] = await Promise.all([
    fetch(`${API_BASE}/dashboard/summary?${summaryParams}`).then(r => r.json()),
    fetch(`${API_BASE}/exams`).then(r => r.json()),
    fetch(`${API_BASE}/classes`).then(r => r.json()),
    fetch(`${API_BASE}/tracks`).then(r => r.json()),
    fetch(`${API_BASE}/students?${studentParams}`).then(r => r.json()),
    fetch(`${API_BASE}/students?page=1&pageSize=500`).then(r => r.json()),
    fetch(`${API_BASE}/score-records?${params}`).then(r => r.json())
  ])

  dashboardSummary.value = summaryRes
  examList.value = examsRes
  classList.value = classesRes
  trackList.value = tracksRes
  studentList.value = studentsRes.items || []
  allStudents.value = allStudentsRes.items || []
  studentTotal.value = studentsRes.total || 0
  gradeRecords.value = recordsRes.items || []
  recordTotal.value = recordsRes.total || 0
  message.value = `当前筛选已加载完成`

  if (!importForm.exam_id && examList.value.length) importForm.exam_id = examList.value[0].id
  if (!importForm.student_id && allStudents.value.length) importForm.student_id = allStudents.value[0].id
}

function changePage(next) {
  const max = currentPage.value === 'student-maintain' ? studentPageCount.value : recordPageCount.value
  if (next < 1 || next > max) return
  page.value = next
  fetchData()
}

function resetPageAndFetch() {
  page.value = 1
  fetchData()
}

function switchPage(nextPage) {
  if (currentPage.value === nextPage) return
  currentPage.value = nextPage
  page.value = 1
  window.history.pushState({}, '', pagePaths[nextPage])
  fetchData()
}

function applySubject() {
  query.sortBy = query.subject === 'total' ? 'rank_no' : 'subject_rank'
  query.sortOrder = 'asc'
  resetPageAndFetch()
}

function openStudentModal(student) {
  selectedStudent.value = student
  studentModalVisible.value = true
}

function closeStudentModal() {
  studentModalVisible.value = false
}

async function submitImport() {
  const res = await fetch(`${API_BASE}/score-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(importForm)
  })
  const data = await res.json()
  alert(data.message || '录入成功')
  await fetchData()
}

async function boostRecord(item) {
  const payload = {
    chinese: item.chinese + 1,
    math: item.math + 1,
    english: item.english + 1,
    physics: item.physics,
    chemistry: item.chemistry,
    biology: item.biology,
    politics: item.politics,
    history: item.history,
    geography: item.geography
  }
  const res = await fetch(`${API_BASE}/score-records/${item.score_id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  alert(data.message || '修改成功')
  await fetchData()
}

onMounted(() => {
  window.addEventListener('popstate', () => {
    currentPage.value = pageFromPath(window.location.pathname)
    page.value = 1
    fetchData()
  })
  fetchData()
})
</script>
