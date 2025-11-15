# Bash Script Review Checklist
## دليل المراجعة الشامل للسكربتات

استخدم هذا الدليل لمراجعة وتحسين سكربتات Bash في مشروع cam1-v2

---

## ✅ Security Checklist (OWASP Standards)

### Input Validation
- [ ] جميع المدخلات من المستخدم يتم التحقق منها (regex validation)
- [ ] لا يوجد استخدام لـ `eval` مع مدخلات المستخدم
- [ ] جميع المتغيرات مقتبسة (quoted) لمنع command injection
- [ ] التحقق من Directory Traversal (`..` في المسارات)
- [ ] استخدام whitelists بدلاً من blacklists للتحقق

**مثال:**
```bash
# ❌ خطير
eval "$user_input"

# ✅ آمن
if [[ "$user_input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    process "$user_input"
fi
```

### Credentials & Secrets
- [ ] لا توجد credentials hardcoded في السكربت
- [ ] استخدام environment variables للبيانات الحساسة
- [ ] ملفات الـ config تحمل permissions صحيحة (600 أو 640)
- [ ] عدم طباعة passwords في logs
- [ ] استخدام key-based authentication بدلاً من passwords

**الفحص:**
```bash
# البحث عن credentials محتملة
grep -i "password\|secret\|key" script/*.sh
```

### File Operations
- [ ] استخدام absolute paths أو validated relative paths
- [ ] التحقق من file permissions قبل القراءة/الكتابة
- [ ] استخدام atomic operations للكتابة (temp file + rename)
- [ ] file locking للعمليات المتزامنة
- [ ] التحقق من disk space قبل الكتابة

---

## 🛡️ Error Handling Checklist

### Strict Mode
- [ ] `set -e` - إيقاف عند الأخطاء
- [ ] `set -u` - معاملة متغيرات غير معرفة كأخطاء
- [ ] `set -o pipefail` - كشف أخطاء pipelines
- [ ] `IFS=$'\n\t'` - حماية من word splitting

**الكود:**
```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

### Error Messages
- [ ] جميع الأخطاء تُطبع إلى stderr (`>&2`)
- [ ] رسائل خطأ واضحة ومفيدة
- [ ] exit codes موثقة ومحددة
- [ ] استخدام trap للـ cleanup

**مثال:**
```bash
trap 'cleanup $?' EXIT INT TERM
```

### Logging
- [ ] استخدام timestamps في الـ logs
- [ ] log levels واضحة (DEBUG, INFO, WARN, ERROR)
- [ ] logs تُكتب إلى ملف وليس فقط stdout
- [ ] log rotation للملفات الكبيرة
- [ ] عدم كتابة بيانات حساسة في logs

---

## 📝 Code Quality Checklist (Google Standards)

### Documentation
- [ ] header comment يشرح غرض السكربت
- [ ] توثيق dependencies المطلوبة
- [ ] usage/help message متوفرة
- [ ] جميع functions موثقة
- [ ] environment variables موثقة
- [ ] exit codes موثقة

**Template:**
```bash
#######################################
# Function description
# Globals:
#   VAR_NAME
# Arguments:
#   $1 - First argument
# Returns:
#   0 on success, 1 on failure
#######################################
```

### Variable Naming
- [ ] constants بأحرف كبيرة: `readonly MAX_RETRIES=3`
- [ ] local variables بأحرف صغيرة: `local file_path`
- [ ] variables دائماً مقتبسة: `"$var"` ليس `$var`
- [ ] استخدام `readonly` للـ constants
- [ ] استخدام `local` داخل functions

### Function Design
- [ ] كل function تقوم بمهمة واحدة فقط
- [ ] functions أقل من 50 سطر (Google guideline)
- [ ] تجنب global variables
- [ ] استخدام return codes بدلاً من echo للنتائج
- [ ] parameter validation في بداية كل function

---

## ⚡ Performance Checklist

### Built-ins vs External Commands
- [ ] استخدام `[[ ]]` بدلاً من `[ ]`
- [ ] استخدام parameter expansion بدلاً من `sed`/`awk`
- [ ] تجنب `cat` غير الضروري (useless cat)
- [ ] استخدام bash built-ins حيثما ممكن
- [ ] استخدام `mapfile`/`readarray` بدلاً من loops

**مثال:**
```bash
# ❌ بطيء
filename=$(basename "$path")
dir=$(dirname "$path")

# ✅ سريع
filename="${path##*/}"
dir="${path%/*}"
```

### Loop Optimization
- [ ] تجنب loops داخل loops
- [ ] استخدام parallel processing للعمليات المستقلة
- [ ] تجنب subshells غير الضرورية
- [ ] استخدام `while read` بدلاً من `for` للملفات الكبيرة

### I/O Optimization
- [ ] تقليل عدد file operations
- [ ] batch operations حيثما ممكن
- [ ] استخدام buffers للقراءة/الكتابة
- [ ] تجنب قراءة نفس الملف عدة مرات

---

## 🧪 Testing & Quality Assurance

### ShellCheck
- [ ] السكربت يمر بـ ShellCheck بدون أخطاء
- [ ] جميع التحذيرات ذات الأولوية العالية معالجة
- [ ] استخدام `# shellcheck disable=SCxxxx` فقط عند الضرورة
- [ ] توثيق سبب تعطيل أي تحذير

**الأمر:**
```bash
shellcheck -x script/*.sh
```

### Manual Testing
- [ ] اختبار مع مدخلات صحيحة
- [ ] اختبار مع مدخلات خاطئة/ضارة
- [ ] اختبار مع ملفات غير موجودة
- [ ] اختبار مع permissions غير كافية
- [ ] اختبار في ظروف network failure

### Edge Cases
- [ ] التعامل مع أسماء ملفات تحتوي مسافات
- [ ] التعامل مع paths طويلة
- [ ] التعامل مع special characters
- [ ] التعامل مع empty strings
- [ ] التعامل مع disk full

---

## 📊 Score Card

استخدم هذا الجدول لتقييم كل سكربت:

| الفئة | الوزن | النقاط | الملاحظات |
|------|-------|---------|-----------|
| **Security** | 30% | __/30 | |
| **Error Handling** | 20% | __/20 | |
| **Code Quality** | 20% | __/20 | |
| **Performance** | 15% | __/15 | |
| **Testing** | 15% | __/15 | |
| **المجموع** | 100% | __/100 | |

**التقييم:**
- 90-100: ممتاز ✅
- 75-89: جيد جداً ⭐
- 60-74: جيد ✔️
- 50-59: مقبول ⚠️
- أقل من 50: يحتاج تحسين ❌

---

## 🔍 Automated Checks

### Pre-commit Hook
```bash
#!/usr/bin/env bash
# .git/hooks/pre-commit

files=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$\|sh.*_$')

if [[ -n "$files" ]]; then
    echo "Running ShellCheck on modified scripts..."

    for file in $files; do
        shellcheck "$file" || exit 1
    done

    echo "✓ All checks passed"
fi
```

### CI/CD Integration
```yaml
# .github/workflows/shellcheck.yml
name: ShellCheck
on: [push, pull_request]
jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          scandir: './script'
          severity: warning
```

---

## 📋 Review Template

استخدم هذا Template عند مراجعة سكربت:

```markdown
## Script Review: [script_name]

**Reviewer:** [your_name]
**Date:** [date]
**Version:** [version]

### Summary
[Brief description of what the script does]

### Security Issues
- [ ] Issue 1: [description]
- [ ] Issue 2: [description]

### Error Handling Issues
- [ ] Issue 1: [description]

### Code Quality Issues
- [ ] Issue 1: [description]

### Performance Issues
- [ ] Issue 1: [description]

### Recommendations
1. [Recommendation 1]
2. [Recommendation 2]

### Overall Score: __/100

### Approval Status
- [ ] Approved ✅
- [ ] Approved with minor changes ⭐
- [ ] Requires changes ⚠️
- [ ] Rejected ❌

### Next Steps
1. [Action item 1]
2. [Action item 2]
```

---

## 🎯 Priority Levels

عند مراجعة السكربتات، رتب المشاكل حسب الأولوية:

### 🔴 Critical (P0) - يجب إصلاحها فوراً
- Security vulnerabilities (command injection, etc.)
- Data loss risks
- System crash risks
- Hardcoded credentials

### 🟡 High (P1) - يجب إصلاحها قريباً
- Missing error handling
- No input validation
- Poor logging
- Missing documentation

### 🟢 Medium (P2) - جيد أن تُصلح
- Performance issues
- Code duplication
- Non-standard naming
- Missing tests

### ⚪ Low (P3) - اختياري
- Style inconsistencies
- Minor optimizations
- Extra features

---

## 📚 Quick Reference Commands

### Find Security Issues
```bash
# بحث عن credentials محتملة
grep -rn "password\|secret\|key\|token" script/

# بحث عن eval usage
grep -rn "eval" script/

# بحث عن unquoted variables
grep -rn '\$[A-Za-z_]' script/ | grep -v '"'
```

### Find Performance Issues
```bash
# بحث عن useless cat
grep -rn "cat.*|" script/

# بحث عن unnecessary subshells
grep -rn '$(' script/

# بحث عن external commands في loops
grep -A5 "for\|while" script/ | grep "sed\|awk\|grep"
```

### Code Metrics
```bash
# عدد الأسطر لكل سكربت
wc -l script/*

# عدد الـ functions لكل سكربت
grep -c "^[a-z_]*() {" script/*

# Complexity (عدد الـ if/while/for)
grep -c "if\|while\|for" script/*
```

---

**آخر تحديث:** 2025-11-15
**الإصدار:** 1.0.0
**المصادر:** Google Shell Style Guide, OWASP, ShellCheck, MIT Safe Shell
