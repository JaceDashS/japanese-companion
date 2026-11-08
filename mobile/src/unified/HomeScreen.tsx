import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { toLearningPathKey } from "../../.generated/product/shared/controllers/domain/learningPath.js";
import { getStageLabel } from "../../.generated/product/shared/domain/constants.js";
import type { LearningPath } from "../../../shared/domain/studyTypes";
import type { StudyModel } from "./useStudyModel";
import { Action, Card, Field, Label, layout, Meter } from "./ui";
import { WordActions } from "./WordActions";
import { Stats, StageChart } from "./Dashboard";

/** Home, Day search and progress reuse the existing dashboard builders and learning plan. */
export function HomeScreen({ model, tab, today, desktop, notify }: { desktop: boolean; model: StudyModel; tab: "today" | "days" | "progress"; today: string; notify: (text: string, tone?: string) => void }) {
  const [query, setQuery] = useState("");
  const [onlyFail, setOnlyFail] = useState(false);
  const [wordPath, setWordPath] = useState<LearningPath | null>(null);
  const { dashboard: d, srs } = model;
  const pending = new Set(model.queue.items.filter((entry: any) => entry.status !== "failed").map((entry: any) => entry.learningPath && toLearningPathKey(entry.learningPath)));
  const reviews = d.reviewDue.filter((row: any) => !pending.has(toLearningPathKey(row.path)));
  const learning = d.pendingLearningRows.filter((row: any) => !pending.has(toLearningPathKey(row.path)));
  const rows = d.allDayRows;
  const stages = Array.from({ length: srs.maxReviewStage }, (_, index) => ({ stage: index + 1, count: rows.filter((row: any) => Math.max(1, Math.min(srs.maxReviewStage, Number(row.stage) || 1)) === index + 1).length }));
  const rowCard = (row: any, review: boolean) => <Card key={(review ? "r:" : "l:") + toLearningPathKey(row.path)} title={row.dayTitle}>
    <Label muted>{review ? `복습 ${row.reviewRound}회차 · ${row.dueCount}개` : `신규 · ${row.itemCount}개`}{row.failCount ? ` · 오답 ${row.failCount}` : ""}</Label>
    {row.missingDecompositionCount > 0 ? <><Label muted>디컴포지션 {row.missingDecompositionCount}개가 비어 있습니다.</Label><Action title="단어 복사와 디컴포지션 입력" onPress={() => setWordPath(row.path)} /></> : <View style={layout.row}><Action title={review ? "복습 시작" : "학습 시작"} onPress={() => review ? model.openReviewDay(row.path, row.dueItemIds) : model.openLearningDay(row.path)} /><Action title="단어 작업" onPress={() => setWordPath(row.path)} /></View>}
  </Card>;
  const progress = <Card title="전체 진행률">
      <Meter label="Day 완료" value={`${d.overallMeta.completedDays}/${d.overallMeta.uniqueDayTotal}`} ratio={d.overallMeta.completedRatio} />
      <Meter label="평균 복습 회차" value={`${(1 + d.overallMeta.avgStageRatio * (srs.maxReviewStage - 1)).toFixed(2)} / ${srs.maxReviewStage}`} ratio={d.overallMeta.avgStageRatio} />
      <Label muted>데이터상 최대 Day 인덱스 {d.overallMeta.maxDayIndex || 0}</Label>
      <Field label="시작일 YYYY-MM-DD" value={model.plan.start} onChangeText={(value) => model.updatePlan({ ...model.plan, start: value })} /><Field label="종료일 YYYY-MM-DD" value={model.plan.end} onChangeText={(value) => model.updatePlan({ ...model.plan, end: value })} />
      {d.dateRangeMeta.valid ? <Meter label="기간 경과" value={`${d.dateRangeMeta.elapsedDays}/${d.dateRangeMeta.totalDays}일 · 남은 ${d.dateRangeMeta.remainingDays}일`} ratio={d.dateRangeMeta.ratio} /> : <Label error>기간 형식이 올바르지 않거나 종료일이 시작일보다 빠릅니다.</Label>}
    </Card>;
  const recent = <Card title="최근 학습">{rows.filter((row: any) => row.lastAttemptDate).sort((a: any, b: any) => String(b.lastAttemptDate).localeCompare(String(a.lastAttemptDate))).slice(0, 5).map((row: any) => <Action key={toLearningPathKey(row.path)} title={`${row.dayTitle} · ${row.lastAttemptDate} · 정답률 ${Math.round(row.passRatio * 100)}% · ${getStageLabel(row.stage, srs.maxReviewStage)}`} onPress={() => model.openLearningDay(row.path)} />)}{!rows.some((row: any) => row.lastAttemptDate) && <Label muted>아직 학습 기록이 없습니다.</Label>}</Card>;
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.body}>
    <View style={[layout.row, { justifyContent: "space-between" }]}><View style={{ gap: 4 }}><Label large>{tab === "today" ? "오늘 할 학습" : tab === "days" ? "Day 선택" : "전체 진행률"}</Label><Label muted>{today} · 매일 조금씩, 쌓이는 실력</Label></View><Action title="새로고침" onPress={() => void model.refresh().catch((error) => notify(String(error), "error"))} /></View>
    {model.books.length > 1 && <View style={layout.row}>{model.books.map((book: any) => <Action key={book.id} title={book.title} selected={book.id === model.book} onPress={() => void model.switchBook(book.id).catch((error) => notify(String(error), "error"))} />)}</View>}
    {tab === "today" && <>
      <Stats items={[
        { label: "오늘 복습", value: String(reviews.length), detail: `복습할 단어 ${reviews.reduce((sum: number, row: any) => sum + row.dueCount, 0)}개` },
        { label: "신규 학습", value: String(learning.length), detail: `새로운 단어 ${learning.reduce((sum: number, row: any) => sum + row.itemCount, 0)}개` },
        { label: "학습한 Day", value: `${d.overallMeta.completedDays}/${d.overallMeta.uniqueDayTotal}`, detail: `졸업 ${rows.filter((row: any) => row.stage >= srs.maxReviewStage).length}개` },
        { label: "다시 볼 단어", value: String(rows.reduce((sum: number, row: any) => sum + row.failCount, 0)), detail: d.dateRangeMeta.valid ? `목표일까지 ${d.dateRangeMeta.remainingDays}일` : "나만의 속도로 꾸준히" },
      ]} />
      <View style={{ flexDirection: desktop ? "row" : "column", alignItems: "flex-start", gap: 18 }}>
        <View style={{ flex: desktop ? 1.65 : undefined, width: desktop ? undefined : "100%", minWidth: 0 }}>
          <Card title="학습 대기열"><Label muted>복습 {reviews.length} · 신규 {learning.length}</Label>
            {reviews.map((row: any) => rowCard(row, true))}{learning.map((row: any) => rowCard(row, false))}
            {!reviews.length && !learning.length && <Label muted>{d.learningPlanRows.length > 0 ? "오늘 몫을 모두 끝냈습니다. 내일 다시 만나요." : "신규 학습 가능한 Day가 없습니다."}</Label>}
          </Card>
        </View>
        <View style={{ flex: desktop ? 1 : undefined, width: desktop ? undefined : "100%", minWidth: 0, gap: 18 }}>
          <StageChart stages={stages.map(({ stage, count }) => ({ label: getStageLabel(stage, srs.maxReviewStage), count }))} />
          {desktop && progress}
          {recent}
        </View>
      </View>
    </>}

    {tab === "days" && <>
      <Field label="Day 검색" value={query} onChangeText={setQuery} /><Action title="오답만" selected={onlyFail} onPress={() => setOnlyFail(!onlyFail)} />
      {!rows.some((row: any) => (!query.trim() || row.dayTitle.includes(query.trim())) && (!onlyFail || row.failCount > 0)) && <Label muted>조건에 맞는 Day가 없습니다.</Label>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {rows.filter((row: any) => (!query.trim() || row.dayTitle.includes(query.trim())) && (!onlyFail || row.failCount > 0)).map((row: any) => <View key={toLearningPathKey(row.path)} style={{ flexBasis: desktop ? "30%" : "100%", flexGrow: 1, minWidth: 0 }}><Card title={row.dayTitle}><Label muted>{getStageLabel(row.stage, srs.maxReviewStage)} · {row.itemCount}개 · 오답 {row.failCount}</Label><Meter label="정답률" value={`${Math.round(row.passRatio * 100)}%`} ratio={row.passRatio} />{row.nextReviewDate && <Label muted>복습 {row.nextReviewDate}</Label>}<Action title="학습하기" onPress={() => model.openLearningDay(row.path)} /></Card></View>)}
      </View>
    </>}
    {tab === "progress" && progress}

    {wordPath && <WordActions model={model} path={wordPath} onClose={() => setWordPath(null)} notify={notify} />}
  </ScrollView>;
}
