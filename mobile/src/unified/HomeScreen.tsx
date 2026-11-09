import React, { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { toLearningPathKey } from "../../.generated/product/shared/controllers/domain/learningPath.js";
import { getStageLabel } from "../../.generated/product/shared/domain/constants.js";
import type { StudyModel } from "./useStudyModel";
import { Card, layout, Segment, T } from "./ui";
import { DayCard, DayGrid, ProgressPanel, RecentDays, StageChart, Stats, WordActionCard } from "./Dashboard";

/** Today, Day and progress tabs in the former dashboard composition, backed by the shared dashboard builders. */
export function HomeScreen({ model, tab, today, desktop, notify }: { desktop: boolean; model: StudyModel; tab: "today" | "days" | "progress"; today: string; notify: (text: string, tone?: string) => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const { dashboard: d, srs } = model;
  const phone = !desktop;
  const pending = new Set(model.queue.items.filter((entry: any) => entry.status !== "failed").map((entry: any) => entry.learningPath && toLearningPathKey(entry.learningPath)));
  const reviews = d.reviewDue.filter((row: any) => !pending.has(toLearningPathKey(row.path)));
  const learning = d.pendingLearningRows.filter((row: any) => !pending.has(toLearningPathKey(row.path)));
  const rows = d.allDayRows;
  const refresh = () => { setRefreshing(true); model.refresh().catch((error) => notify(String(error), "error")).finally(() => setRefreshing(false)); };
  const books = model.books.length > 1 && <View style={{ flexDirection: "row", alignItems: "center", gap: 10, maxWidth: desktop ? 420 : undefined }}>
    <T size={12.2} tone="dim">교재</T>
    <Segment options={model.books.map((book: any) => ({ key: book.id, label: book.title }))} value={model.book} onChange={(id) => void model.switchBook(String(id)).catch((error) => notify(String(error), "error"))} />
  </View>;
  const wordCard = (row: any, review: boolean) => {
    const mode = review ? "복습" : "학습";
    return <WordActionCard key={(review ? "r:" : "l:") + toLearningPathKey(row.path)} title={row.dayTitle} chip={row.failCount > 0 ? `${mode}・실패` : mode} chipTone={row.failCount > 0 ? "fail" : review ? "review" : "learning"}
      missing={row.missingDecompositionCount} total={review ? row.dueCount : row.itemCount} mode={mode} notify={notify} copy={() => model.dayCopy(row.path)} importText={async (text) => Boolean(await model.importDay(row.path, text))} />;
  };
  const queue = <View style={{ gap: 10 }}>
    {reviews.map((row: any) => row.missingDecompositionCount > 0 ? wordCard(row, true) : <DayCard key={"r:" + toLearningPathKey(row.path)} title={row.dayTitle} tone="review" chip={row.failCount > 0 ? "복습・실패" : "복습"} chipTone={row.failCount > 0 ? "fail" : "review"} meta={[`대상 ${row.dueCount}개`, `회차 ${row.reviewRound}/5`]} onPress={() => model.openReviewDay(row.path, row.dueItemIds)} />)}
    {learning.map((row: any) => row.missingDecompositionCount > 0 ? wordCard(row, false) : <DayCard key={"l:" + toLearningPathKey(row.path)} title={row.dayTitle} tone="learning" chip={row.failCount > 0 ? "학습・실패" : "학습"} chipTone={row.failCount > 0 ? "fail" : "learning"} meta={[`Day ${row.dayIndex}`, `전체 ${row.sequenceIndex}/${row.totalDayCount}`, `신규 ${row.itemCount}개`]} onPress={() => model.openLearningDay(row.path)} />)}
    {!reviews.length && !learning.length && <T size={13.1} tone="muted">{d.learningPlanRows.length > 0 ? `오늘 몫을 모두 끝냈습니다. 새 학습은 ${today} 다음 날에 다시 배정됩니다.` : "신규 학습 가능한 Day가 없습니다."}</T>}
  </View>;
  const stageChart = <StageChart stages={Array.from({ length: srs.maxReviewStage }, (_, index) => ({ label: getStageLabel(index + 1, srs.maxReviewStage), count: rows.filter((row: any) => Math.max(1, Math.min(srs.maxReviewStage, Math.round(Number(row.stage) || 1))) === index + 1).length }))} />;
  const progress = <ProgressPanel d={d} srsMax={srs.maxReviewStage} plan={model.plan} onPlan={model.updatePlan} />;
  const recent = <RecentDays rows={rows} today={today} maxStage={srs.maxReviewStage} onOpen={model.openLearningDay} />;
  const failTotal = rows.reduce((sum: number, row: any) => sum + row.failCount, 0);
  const stats = <Stats phone={phone} items={[
    { accent: "info", label: "오늘 복습", value: `${reviews.length}개`, hint: reviews.length ? `단어 ${reviews.reduce((sum: number, row: any) => sum + row.dueCount, 0)}개` : "예정 없음" },
    { accent: "good", label: "오늘 신규", value: `${learning.length}개`, hint: learning.length ? `단어 ${learning.reduce((sum: number, row: any) => sum + row.itemCount, 0)}개` : "오늘 몫 완료" },
    { accent: "accent", label: "시작한 Day", value: `${d.overallMeta.completedDays}/${d.overallMeta.uniqueDayTotal}`, hint: `졸업 ${rows.filter((row: any) => row.stage >= srs.maxReviewStage).length}개` },
    { accent: "warn", label: "시험까지", value: d.dateRangeMeta.valid ? `${d.dateRangeMeta.remainingDays}일` : "미설정", hint: failTotal > 0 ? `오답 ${failTotal}개 남음` : "오답 없음" },
  ]} />;

  let content: React.ReactNode;
  if (tab === "days") content = <Card title="Day 선택" hint={`${rows.length}개`}><DayGrid rows={rows} phone={phone} onOpen={model.openLearningDay} /></Card>;
  else if (tab === "progress") content = <Card title="전체 진행률">{progress}</Card>;
  else if (phone) content = <>
    {stats}{books}
    <Card title="오늘 할 학습" hint={`복습 ${reviews.length} · 신규 ${learning.length}`}>{queue}</Card>
    <Card title="복습 회차 분포" hint={`${rows.length}개`}>{stageChart}</Card>
    <Card title="최근 학습">{recent}</Card>
  </>;
  else content = <>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <View style={{ minWidth: 0 }}><T size={21.6} serif weight="700" style={{ lineHeight: 30 }}>오늘 할 학습</T><T size={13.1} tone="muted" style={{ marginTop: 5 }}>{today} · 복습 {reviews.length}개 · 신규 {learning.length}개</T></View>
      {books}
    </View>
    {stats}
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
      <View style={{ flex: 1.25, minWidth: 0 }}><Card title="학습 대기열" hint={`${reviews.length + learning.length}건`}>{queue}</Card></View>
      <View style={{ flex: 0.75, minWidth: 300, gap: 14 }}>
        <Card title="복습 회차 분포" hint={`${rows.length}개`}>{stageChart}</Card>
        <Card title="진행률">{progress}</Card>
        <Card title="최근 학습">{recent}</Card>
      </View>
    </View>
  </>;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={phone ? layout.phoneBody : layout.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>{content}</ScrollView>;
}
