/* ============================================================
 * DataQuiz · 智数刷题 —— 应用逻辑
 * Vue3 全局构建（CDN / 本地 lib）
 * ============================================================ */

const STORAGE_KEY = 'dataquiz_records_v1'

const TYPE_FILES = {
  'single-choice': './data/single-choice.json',
  'multiple-choice': './data/multiple-choice.json',
  'true-false': './data/true-false.json',
  'short-answer': './data/short-answer.json'
}

const TYPE_LABELS = {
  'single-choice': '单选题',
  'multiple-choice': '多选题',
  'true-false': '判断题',
  'short-answer': '简答题'
}

const EMPTY_RECORDS = () => ({
  'single-choice': {},
  'multiple-choice': {},
  'true-false': {},
  'short-answer': {}
})

Vue.createApp({
  data() {
    return {
      // 视图：home | quiz | result
      view: 'home',

      // 当前题型与题目
      currentType: 'single-choice',
      currentIndex: 0,
      currentList: [],
      currentQuestion: {},

      // 当前题目的临时作答
      userAnswer: {
        single: null,
        multiple: [],
        judge: null,
        shortAnswer: ''
      },
      showResult: false,

      // 题库与计数
      banks: {
        'single-choice': [],
        'multiple-choice': [],
        'true-false': [],
        'short-answer': []
      },
      counts: {
        'single-choice': 0,
        'multiple-choice': 0,
        'true-false': 0,
        'short-answer': 0
      },

      // 答题记录：records[type][questionId] = { value | text, correct, submitted }
      records: EMPTY_RECORDS(),

      // 首页卡片上的已答数
      progress: {
        'single-choice': { answered: 0 },
        'multiple-choice': { answered: 0 },
        'true-false': { answered: 0 },
        'short-answer': { answered: 0 }
      },

      // 结果页
      resultType: '',
      resultScore: 0,
      resultTotal: 0,
      resultCorrect: 0,
      resultWrong: 0,
      resultRate: 0,
      resultSummaryText: '',
      wrongList: []
    }
  },

  computed: {
    currentCorrect() {
      if (!this.currentQuestion || !this.currentQuestion.id) return false
      const rec = this.records[this.currentType][this.currentQuestion.id]
      return rec ? !!rec.correct : false
    },
    answeredCount() {
      return this.currentList.filter(q => {
        const rec = this.records[this.currentType][q.id]
        return rec && rec.submitted
      }).length
    }
  },

  methods: {
    /* ---------- 工具 ---------- */
    typeLabel(type) {
      return TYPE_LABELS[type] || ''
    },
    optionKey(idx) {
      return String.fromCharCode(65 + idx)
    },
    arraysEqual(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return false
      if (a.length !== b.length) return false
      const sa = [...a].sort((x, y) => x - y)
      const sb = [...b].sort((x, y) => x - y)
      return sa.every((v, i) => v === sb[i])
    },
    formatAnswer(text) {
      if (!text) return ''
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
    },

    /* ---------- 题库加载 ---------- */
    async loadBanks() {
      try {
        const entries = await Promise.all(
          Object.entries(TYPE_FILES).map(async ([type, url]) => {
            const res = await fetch(url)
            if (!res.ok) throw new Error(`${url} 加载失败（HTTP ${res.status}）`)
            const data = await res.json()
            return [type, data]
          })
        )
        entries.forEach(([type, data]) => {
          this.banks[type] = Array.isArray(data) ? data : []
          this.counts[type] = this.banks[type].length
        })
        this.initProgress()
      } catch (err) {
        console.error(err)
        alert(
          '题库加载失败：' + err.message +
          '\n\n请确认：\n1. 已通过本地服务器打开页面（不要直接双击 index.html）；\n2. data/ 目录下四个 JSON 文件存在。'
        )
      }
    },

    /* ---------- 持久化 ---------- */
    loadRecords() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        Object.keys(this.records).forEach(type => {
          if (parsed && typeof parsed[type] === 'object' && parsed[type] !== null) {
            this.records[type] = parsed[type]
          }
        })
      } catch (err) {
        console.warn('读取本地记录失败', err)
      }
    },
    saveRecords() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records))
      } catch (err) {
        console.warn('保存本地记录失败', err)
      }
    },
    initProgress() {
      Object.keys(this.progress).forEach(type => this.updateProgress(type))
    },
    updateProgress(type) {
      const recs = this.records[type] || {}
      const answered = Object.values(recs).filter(r => r && r.submitted).length
      if (this.progress[type]) this.progress[type].answered = answered
    },

    /* ---------- 视图切换 ---------- */
    switchType(type) {
      const list = this.banks[type] || []
      if (list.length === 0) {
        alert('该题型题库尚未加载完成，请稍候或检查 data/ 目录。')
        return
      }
      this.currentType = type
      this.currentList = list
      this.currentIndex = 0
      this.view = 'quiz'
      this.loadCurrent()
    },
    backHome() {
      this.view = 'home'
    },
    loadCurrent() {
      const q = this.currentList[this.currentIndex]
      this.currentQuestion = q || {}
      const rec = q ? this.records[this.currentType][q.id] : null
      this.userAnswer = { single: null, multiple: [], judge: null, shortAnswer: '' }
      if (rec && rec.submitted) {
        this.showResult = true
        if (this.currentType === 'single-choice') {
          this.userAnswer.single = rec.value
        } else if (this.currentType === 'multiple-choice') {
          this.userAnswer.multiple = Array.isArray(rec.value) ? [...rec.value] : []
        } else if (this.currentType === 'true-false') {
          this.userAnswer.judge = rec.value
        } else if (this.currentType === 'short-answer') {
          this.userAnswer.shortAnswer = rec.text || ''
        }
      } else {
        this.showResult = false
      }
    },

    /* ---------- 作答 ---------- */
    selectOption(idx) {
      if (this.showResult) return
      if (this.currentType === 'single-choice') {
        this.userAnswer.single = idx
      } else if (this.currentType === 'multiple-choice') {
        const arr = this.userAnswer.multiple
        const pos = arr.indexOf(idx)
        if (pos >= 0) arr.splice(pos, 1)
        else arr.push(idx)
      }
    },
    selectJudge(val) {
      if (this.showResult) return
      this.userAnswer.judge = val
    },

    /* ---------- 判分 ---------- */
    submitCurrent() {
      const q = this.currentQuestion
      if (!q || !q.id) return
      const type = this.currentType

      // 未作答校验
      if (type === 'single-choice' && this.userAnswer.single === null) {
        alert('请先选择一个选项')
        return
      }
      if (type === 'multiple-choice' && this.userAnswer.multiple.length === 0) {
        alert('请至少选择一个选项')
        return
      }
      if (type === 'true-false' && this.userAnswer.judge === null) {
        alert('请选择"正确"或"错误"')
        return
      }

      const rec = { submitted: true }

      if (type === 'single-choice') {
        rec.value = this.userAnswer.single
        rec.correct = this.userAnswer.single === q.answerIndex
      } else if (type === 'multiple-choice') {
        rec.value = [...this.userAnswer.multiple]
        rec.correct = this.arraysEqual(rec.value, q.answerIndex)
      } else if (type === 'true-false') {
        rec.value = this.userAnswer.judge
        rec.correct = this.userAnswer.judge === q.answer
      } else if (type === 'short-answer') {
        rec.text = this.userAnswer.shortAnswer
      }

      this.records[type][q.id] = rec
      this.showResult = true
      this.saveRecords()
      this.updateProgress(type)
    },

    /* ---------- 选项状态 ---------- */
    optionClass(idx) {
      const cls = []
      if (this.currentType === 'single-choice') {
        if (this.userAnswer.single === idx) cls.push('selected')
      } else if (this.currentType === 'multiple-choice') {
        if (this.userAnswer.multiple.includes(idx)) cls.push('selected')
      }
      if (this.showResult) {
        if (this.isOptionCorrect(idx)) cls.push('correct')
        if (this.isOptionWrong(idx)) cls.push('wrong')
      }
      return cls.join(' ')
    },
    isOptionCorrect(idx) {
      if (!this.showResult) return false
      const q = this.currentQuestion
      if (this.currentType === 'single-choice') return idx === q.answerIndex
      if (this.currentType === 'multiple-choice') {
        return Array.isArray(q.answerIndex) && q.answerIndex.includes(idx)
      }
      return false
    },
    isOptionWrong(idx) {
      if (!this.showResult) return false
      const q = this.currentQuestion
      if (this.currentType === 'single-choice') {
        return this.userAnswer.single === idx && idx !== q.answerIndex
      }
      if (this.currentType === 'multiple-choice') {
        return this.userAnswer.multiple.includes(idx) &&
          !(Array.isArray(q.answerIndex) && q.answerIndex.includes(idx))
      }
      return false
    },
    judgeClass(val) {
      const cls = []
      if (this.userAnswer.judge === val) cls.push('selected')
      if (this.showResult) {
        if (val === this.currentQuestion.answer) cls.push('correct')
        else if (this.userAnswer.judge === val) cls.push('wrong')
      }
      return cls.join(' ')
    },

    /* ---------- 导航 ---------- */
    gotoQuestion(idx) {
      if (idx < 0 || idx >= this.currentList.length) return
      this.currentIndex = idx
      this.loadCurrent()
    },
    prevQuestion() {
      if (this.currentIndex > 0) this.gotoQuestion(this.currentIndex - 1)
    },
    nextQuestion() {
      if (this.currentIndex < this.currentList.length - 1) {
        this.gotoQuestion(this.currentIndex + 1)
      }
    },
    sheetCellClass(idx) {
      const q = this.currentList[idx]
      const rec = q ? this.records[this.currentType][q.id] : null
      const cls = []
      if (idx === this.currentIndex) cls.push('current')
      if (rec && rec.submitted) {
        if (this.currentType === 'short-answer') cls.push('answered')
        else cls.push(rec.correct ? 'correct' : 'wrong')
      }
      return cls.join(' ')
    },

    /* ---------- 结果 ---------- */
    finishQuiz() {
      const type = this.currentType
      const list = this.currentList
      let correct = 0, wrong = 0, submitted = 0, unsubmitted = 0
      const wrongs = []

      list.forEach(q => {
        const rec = this.records[type][q.id]
        if (rec && rec.submitted) {
          submitted++
          if (type === 'short-answer') return
          if (rec.correct) correct++
          else {
            wrong++
            wrongs.push(q)
          }
        } else {
          unsubmitted++
          if (type !== 'short-answer') {
            wrong++
            wrongs.push(q)
          }
        }
      })

      this.resultType = type
      this.resultTotal = list.length
      this.resultCorrect = correct
      this.resultWrong = wrong
      this.resultRate = list.length ? Math.round((correct / list.length) * 100) : 0
      this.resultScore = this.resultRate
      this.wrongList = wrongs

      if (type === 'short-answer') {
        this.resultScore = '—'
        this.resultSummaryText =
          `共 ${list.length} 题，已提交 ${submitted} 题，未提交 ${unsubmitted} 题（简答题不参与机器判分）`
      } else {
        this.resultSummaryText =
          `共 ${list.length} 题，答对 ${correct} 题，答错 ${wrong} 题，正确率 ${this.resultRate}%`
      }

      this.view = 'result'
    },
    restartType() {
      const type = this.resultType
      if (type) {
        this.records[type] = {}
        this.saveRecords()
        this.updateProgress(type)
        this.switchType(type)
      }
    },

    /* ---------- 重置 ---------- */
    resetAll() {
      if (!confirm('确定要清空所有题型的答题记录吗？此操作不可撤销。')) return
      this.records = EMPTY_RECORDS()
      this.saveRecords()
      this.initProgress()
      this.view = 'home'
    }
  },

  mounted() {
    this.loadRecords()
    this.initProgress()
    this.loadBanks()
  }
}).mount('#app')