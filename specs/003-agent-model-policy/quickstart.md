# Quickstart: Agent Model Policy

**Feature Branch**: `003-agent-model-policy`

## Goal

التحقق بسرعة من أن سياسة ربط النماذج تعمل من واجهة الإعدادات حتى سجل التشغيل الفعلي.

## Prerequisites

1. تثبيت اعتماديات المشروع الجذرية.
2. تثبيت اعتماديات تطبيق سطح المكتب.
3. بناء المكتبة الأساسية قبل تشغيل تطبيق سطح المكتب إذا كان العامل الخلفي يعتمد على نواتج:

`dist`

## Development Flow

1. من جذر المستودع شغّل:

```powershell
npm install
npm run build
```

2. من مجلد تطبيق سطح المكتب شغّل:

```powershell
cd desktop
npm install
npm run dev
```

3. افتح صفحة الإعدادات ثم تبويب سياسة النماذج.

4. تأكد من ظهور:
   - النسخة النشطة من السياسة.
   - تاريخ السريان وتاريخ المراجعة.
   - الملف الجاهز الحالي.
   - التوزيع الموصى به لكل وكيل.

5. اختر ملفًا جاهزًا مختلفًا ثم اطلب معاينة التغييرات قبل التطبيق.

6. طبّق الملف الجاهز وتأكد من تحديث العرض لكل وكيل.

7. غيّر نموذج وكيل واحد يدويًا وأدخل سبب التخصيص.

8. تأكد من أن الوكيل يظهر بحالة:

`manual-override`

مع استمرار ظهور التوصية الأصلية.

## Runtime Verification

1. ابدأ تشغيل فحص جديد من صفحة المسح.

2. قبل إنشاء العامل الخلفي، يجب أن:
   - تتحقق العملية الرئيسية من السياسة والقيود.
   - تحل النموذج الفعلي لكل وكيل.
   - تمنع التشغيل إذا بقي أي وكيل دون ربط صالح.

3. بعد بدء التشغيل، افتح صفحة التقرير أو التاريخ وتأكد من وجود:
   - معرف نسخة السياسة المستخدمة.
   - النموذج الفعلي لكل وكيل.
   - بيان واضح إذا تم التحويل من الأساسي إلى البديل.

## Validation Commands

من الجذر:

```powershell
npm run typecheck
npm test
```

ومن تطبيق سطح المكتب:

```powershell
cd desktop
npm run typecheck
```

## Smoke Checklist

- تظهر السياسة النشطة عند فتح الإعدادات.
- تظهر معاينة الفرق قبل تطبيق أي ملف جاهز.
- يمكن حفظ استثناء يدوي وإزالته.
- يبدأ التشغيل فقط إذا كانت جميع الربطات صالحة.
- يحفظ سجل التشغيل السياسة الفعالة والنموذج الفعلي لكل وكيل.

## Production Blocker Closure Record (004-production-hardening)

The following production blockers from `003-agent-model-policy` are resolved by `004-production-hardening`:

| Blocker | Resolution | Evidence |
|---------|-----------|----------|
| Placeholder runtime — no real execution | Replaced with crew-adapter + real crew library integration | `desktop/electron/runtime/crew-adapter.ts`, `crew-runtime.ts` |
| No automated verification | Release gate with 9 stages covers typecheck, test, build, package, smoke, performance, docs | `desktop/scripts/release-gate.mjs` |
| No packaged-build validation | Smoke validation script + candidate evidence | `desktop/scripts/smoke-validate.mjs` |
| Plaintext credential storage | Migrated to OS keychain via Keytar/DPAPI (FR-016) | `desktop/electron/runtime/credential-store.ts`, `settings-store.ts` |
| No concurrent-run prevention | RUN_ALREADY_ACTIVE guard in IPC handlers (FR-017) | `desktop/electron/ipc/handlers.ts` |
| No partial-completion resilience | Agent-level try/catch with continuation (FR-018) | `desktop/electron/worker/crew-runtime.ts` |
| No data retention policy | Auto-cleanup at 90 days / 100 runs (FR-019) | `desktop/electron/persistence/data-retention.ts` |
| Missing desktop test infrastructure | Split Vitest config (Node + jsdom) with full coverage | `desktop/vitest.config.ts`, test files |
| No operator documentation | Permanent docs under desktop/docs/ | `desktop/docs/production-readiness.md`, `release-signoff.md` |
| No release sign-off workflow | Structured sign-off checklist with gate evidence | `desktop/docs/release-signoff.md` |
