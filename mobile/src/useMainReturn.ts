import { useEffect, useMemo, useRef } from "react";
import { Alert, BackHandler, Platform } from "react-native";
import { confirmAction } from "./unified/platform";
import { createMainReturn } from "./navigation";
/** Register a mounted screen's Back and expose the same action for its list button. */
export function useMainReturn(options: {
  busy?: boolean;
  dirty: boolean;
  exam?: boolean;
  onReturn: () => void;
}) {
  const current = useRef(options);
  current.current = options;
  const active = useRef(false);
  const controller = useMemo(
    () =>
      createMainReturn({
        state: () => ({
          active: active.current,
          busy: !!current.current.busy,
          dirty: current.current.dirty,
        }),
        returnToMain: () => current.current.onReturn(),
        confirm: ({ leave, stay }) => {
          if (Platform.OS === "web") {
            void confirmAction(current.current.exam ? "진행 중인 시험 답안이 사라집니다." : "저장하지 않은 이번 학습 결과가 사라집니다.").then((accepted) => accepted ? leave() : stay());
            return;
          }
          Alert.alert(
            current.current.exam ? "시험 나가기" : "학습 나가기",
            current.current.exam
              ? "진행 중인 시험 답안이 사라집니다."
              : "저장하지 않은 이번 학습 결과가 사라집니다.",
            [
              {
                text: current.current.exam ? "계속 시험" : "계속 학습",
                style: "cancel",
                onPress: stay,
              },
              { text: "나가기", onPress: leave },
            ],
            { cancelable: true, onDismiss: stay },
          );
        },
      }),
    [],
  );
  useEffect(() => {
    active.current = true;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      controller.request,
    );
    return () => {
      active.current = false;
      controller.cancel();
      subscription.remove();
    };
  }, [controller]);
  return controller.request;
}
