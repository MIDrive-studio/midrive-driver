import { Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";

// What a Yes actually means.
//
// "Do you have any unspent convictions?" answered Yes and left there tells the
// office there is something to ask about and nothing about what. These are the
// questions that follow, and they are asked here rather than in a phone call
// because the answers go on the document the driver signs.
//
// The shape comes from the template, not from this file. It is the same
// definition the PDF prints from, so the form somebody fills in and the form
// that gets signed cannot drift apart.

export type FollowUpField = {
  id: string;
  label: string;
  hint?: string;
  kind: "text" | "month" | "choice" | "multi";
  options?: string[];
  showIf?: { field: string; equals: string };
};

export type FollowUp = {
  when: string;
  groupNoun: string;
  addPrompt: string;
  fields: FollowUpField[];
};

/** Several answers to one question, stored as one string. */
const MULTI_SEPARATOR = "; ";

function Choice({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const chosen = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            className={`rounded-xl border px-4 py-2.5 ${
              chosen ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
            }`}
          >
            <Text className={`text-sm font-semibold ${chosen ? "text-marine-700" : "text-ink-muted"}`}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Multi({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const chosen = value ? value.split(MULTI_SEPARATOR).filter(Boolean) : [];

  function toggle(option: string) {
    const next = chosen.includes(option) ? chosen.filter((c) => c !== option) : [...chosen, option];
    // Kept in the template's order rather than the order they were tapped, so
    // two drivers who ticked the same things produce the same string.
    onChange(options.filter((o) => next.includes(o)).join(MULTI_SEPARATOR));
  }

  return (
    <View className="gap-2">
      {options.map((option) => {
        const on = chosen.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => toggle(option)}
            className={`flex-row items-center gap-3 rounded-xl border px-3 py-3 ${
              on ? "border-marine-600 bg-marine-50" : "border-line-strong bg-white"
            }`}
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded border-2 ${
                on ? "border-marine-600 bg-marine-600" : "border-line-strong bg-white"
              }`}
            >
              {on ? <Feather name="check" size={13} color="#ffffff" /> : null}
            </View>
            <Text className={`flex-1 text-sm ${on ? "text-marine-800" : "text-ink-muted"}`}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FollowUpField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="mb-5">
      <Text className="text-[15px] font-semibold leading-6 text-ink">{field.label}</Text>
      {field.hint ? <Text className="mb-2 mt-0.5 text-sm text-ink-subtle">{field.hint}</Text> : <View className="h-2" />}

      {field.kind === "choice" ? (
        <Choice options={field.options ?? ["Yes", "No"]} value={value} onChange={onChange} />
      ) : field.kind === "multi" ? (
        <Multi options={field.options ?? []} value={value} onChange={onChange} />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={field.kind === "month" ? "e.g. March 2021" : undefined}
          className="rounded-lg border border-line-strong bg-white px-4 py-3 text-ink"
          multiline={field.kind === "text"}
        />
      )}
    </View>
  );
}

/** Whether a field is asked at all, given what has been answered above it. */
export function isShown(field: FollowUpField, group: Record<string, string>): boolean {
  if (!field.showIf) return true;
  return group[field.showIf.field] === field.showIf.equals;
}

export function FollowUpForm({
  questionId,
  followUp,
  answers,
  onChange,
  groupCount,
  onAddGroup,
  onRemoveGroup,
}: {
  questionId: string;
  followUp: FollowUp;
  /** The whole flat answer map. Keys here are "<questionId>.<n>.<field>". */
  answers: Record<string, string>;
  onChange: (key: string, value: string) => void;
  groupCount: number;
  onAddGroup: () => void;
  onRemoveGroup: (index: number) => void;
}) {
  const groups = Array.from({ length: groupCount }, (_, i) => i + 1);

  return (
    <View className="mb-2">
      {groups.map((n) => {
        const group: Record<string, string> = {};
        for (const field of followUp.fields) group[field.id] = answers[`${questionId}.${n}.${field.id}`] ?? "";

        return (
          <View key={n} className="mb-4 rounded-xl border border-warn-line bg-warn-surface/40 px-4 py-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-ink">
                {followUp.groupNoun} {groupCount > 1 ? n : ""}
              </Text>
              {n > 1 ? (
                <Pressable onPress={() => onRemoveGroup(n)} hitSlop={8}>
                  <Text className="text-sm font-semibold text-bad-strong">Remove</Text>
                </Pressable>
              ) : null}
            </View>

            {followUp.fields.map((field) =>
              isShown(field, group) ? (
                <Field
                  key={field.id}
                  field={field}
                  value={group[field.id]}
                  onChange={(v) => onChange(`${questionId}.${n}.${field.id}`, v)}
                />
              ) : null
            )}
          </View>
        );
      })}

      <Text className="mb-2 text-[15px] font-semibold leading-6 text-ink">{followUp.addPrompt}</Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onAddGroup}
          className="flex-row items-center gap-2 rounded-xl border border-line-strong bg-white px-4 py-2.5"
        >
          <Feather name="plus" size={16} color="#1f5089" />
          <Text className="text-sm font-semibold text-marine-700">Yes, add another</Text>
        </Pressable>
      </View>
    </View>
  );
}
