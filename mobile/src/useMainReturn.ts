import { useEffect, useMemo, useRef } from "react";
import { Alert, BackHandler, Platform } from "react-native";
import { confirmAction } from "./unified/platform";
import { createMainReturn } from "./navigation";

/** Register a mounted screen's Back (Android hardware back + Web sub-URL popstate) and expose the same action for its list button. */
export function useMainReturn(options: {
  active?: boolean;
  busy?: boolean;
  dirty: boolean;
  exam?: boolean;
  subPath?: string;
  onReturn: () => void;
}) {
  const isActive = options.active !== false;
  const subPath = options.subPath;
  const current = useRef(options);
  current.current = options;
  const active = useRef(false);
  const pushedSubPath = useRef<string | null>(null);

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
          const message = current.current.exam
            ? "진행 중인 시험 답안이 사라집니다."
            : "저장하지 않은 이번 학습 결과가 사라집니다.";
          if (Platform.OS === "web") {
            void confirmAction(message).then((accepted) => {
              if (accepted) {
                leave();
              } else {
                const sub = current.current.subPath;
                if (sub && typeof window !== "undefined") {
                  const targetHash = `#/${sub}`;
                  if (window.location.hash !== targetHash) {
                    window.history.pushState({ companionSub: sub }, "", targetHash);
                  }
                }
                stay();
              }
            });
            return;
          }
          Alert.alert(
            current.current.exam ? "시험 나가기" : "학습 나가기",
            message,
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
    if (!isActive) {
      active.current = false;
      controller.cancel();
      if (Platform.OS === "web" && typeof window !== "undefined" && pushedSubPath.current) {
        const expectedHash = `#/${pushedSubPath.current}`;
        if (window.location.hash === expectedHash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        pushedSubPath.current = null;
      }
      return;
    }

    active.current = true;
    const subscription = BackHandler.addEventListener("hardwareBackPress", controller.request);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (subPath) {
        const targetHash = `#/${subPath}`;
        if (!pushedSubPath.current) {
          if (window.location.hash !== targetHash) {
            window.history.pushState({ companionSub: subPath }, "", targetHash);
          }
        } else if (pushedSubPath.current !== subPath) {
          if (window.location.hash !== targetHash) {
            window.history.replaceState({ companionSub: subPath }, "", targetHash);
          }
        }
        pushedSubPath.current = subPath;
      }

      const onPopState = () => {
        if (!active.current) return;
        const expectedHash = current.current.subPath ? `#/${current.current.subPath}` : null;
        if (expectedHash && window.location.hash === expectedHash) return;
        controller.request();
      };
      window.addEventListener("popstate", onPopState);
      return () => {
        active.current = false;
        controller.cancel();
        subscription.remove();
        window.removeEventListener("popstate", onPopState);
      };
    }

    return () => {
      active.current = false;
      controller.cancel();
      subscription.remove();
    };
  }, [controller, isActive, subPath]);

  useEffect(
    () => () => {
      if (Platform.OS === "web" && typeof window !== "undefined" && pushedSubPath.current) {
        const expectedHash = `#/${pushedSubPath.current}`;
        if (window.location.hash === expectedHash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        pushedSubPath.current = null;
      }
    },
    [],
  );

  return controller.request;
}
