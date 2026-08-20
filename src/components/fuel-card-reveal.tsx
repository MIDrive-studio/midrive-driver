import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { AllocatedCard } from "@/types/fuel";

// The card itself, visible for five minutes.
//
// The countdown is driven off the allocation's expiry rather than a local
// timer, so backgrounding the app or changing the clock doesn't extend the
// window. It is only the visible half of the limit in any case -- once the
// allocation lapses the database stops returning the card at all, so this
// hiding itself is a courtesy, not the control.

type Props = {
  card: AllocatedCard;
  expiresAt: string;
  onComplete: () => void;
};

export function FuelCardReveal({ card, expiresAt, onComplete }: Props) {
  const [showNumber, setShowNumber] = useState(true);
  const [showPin, setShowPin] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setShowNumber(false);
        setShowPin(false);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const expired = secondsLeft <= 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const clock = `${minutes}:${String(seconds).padStart(2, "0")}`;

  if (expired) {
    return (
      <View className="items-center gap-3 py-8">
        <Feather name="clock" size={44} color="#ef4444" />
        <Text className="text-sm font-bold text-slate-900">Card details have been hidden</Text>
        <Text className="px-6 text-center text-xs text-slate-500">
          The five-minute window has expired. Start again to request another card.
        </Text>
        <Pressable onPress={onComplete} className="mt-2 w-full items-center rounded-lg bg-slate-900 py-3">
          <Text className="text-sm font-bold text-white">Record what I spent</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase text-slate-500">Fuel card allocated</Text>
        <View className="flex-row items-center gap-1">
          <Feather name="clock" size={12} color={secondsLeft < 60 ? "#ef4444" : "#f59e0b"} />
          <Text className={`text-xs font-bold ${secondsLeft < 60 ? "text-red-500" : "text-amber-500"}`}>{clock}</Text>
        </View>
      </View>

      <View className="gap-4 rounded-2xl bg-slate-900 p-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Feather name="credit-card" size={18} color="#fbbf24" />
            <Text className="font-bold text-white">{card.card_name}</Text>
          </View>
          {card.provider && <Text className="text-xs uppercase text-slate-400">{card.provider}</Text>}
        </View>

        <View>
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-xs text-slate-400">Card Number</Text>
            <Pressable onPress={() => setShowNumber((v) => !v)} hitSlop={10}>
              <Feather name={showNumber ? "eye-off" : "eye"} size={14} color="#94a3b8" />
            </Pressable>
          </View>
          <Text className="font-mono text-lg tracking-widest text-white">
            {showNumber ? card.card_number : `•••• •••• •••• ${card.last_four}`}
          </Text>
        </View>

        <View>
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-xs text-slate-400">PIN</Text>
            <Pressable onPress={() => setShowPin((v) => !v)} hitSlop={10}>
              <Feather name={showPin ? "eye-off" : "eye"} size={14} color="#94a3b8" />
            </Pressable>
          </View>
          <Text className="font-mono text-lg tracking-widest text-white">{showPin ? card.pin : "••••"}</Text>
        </View>

        {card.expiry_date && (
          <View className="flex-row items-center gap-1">
            <Feather name="key" size={11} color="#94a3b8" />
            <Text className="text-xs text-slate-400">Expires: {card.expiry_date}</Text>
          </View>
        )}
      </View>

      <View className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <Text className="text-xs font-medium text-amber-700">
          Card details will be hidden in {clock}. Complete fuelling before then.
        </Text>
      </View>

      <Pressable
        onPress={onComplete}
        className="flex-row items-center justify-center gap-2 rounded-lg bg-emerald-600 py-4 active:bg-emerald-700"
      >
        <Feather name="check-circle" size={18} color="white" />
        <Text className="text-base font-bold text-white">Fuel Complete</Text>
      </Pressable>
    </View>
  );
}
