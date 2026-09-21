import { useState } from "react";
import { Keyboard, View } from "react-native";
import { GroupReorderList } from "@/components/group-reorder-list";
import { parseMoney, reorderGroups } from "@/domain/budget";
import type {
  AllocationRole,
  AmountRule,
  BudgetDocument,
  BudgetGroup,
  BudgetRow,
  Classification,
} from "@/domain/budget";
import {
  deletionDraft,
  editGroup,
  editRow,
  expressionText,
  parseExpression,
  referenceChoices,
} from "@/domain/budget/editor";
import {
  Action,
  Choices,
  DraftPreview,
  EditorSheet,
  Field,
  Heading,
  Note,
  editorStyles,
} from "./editor-controls";

type Props = {
  document: BudgetDocument;
  busy: boolean;
  error: string | null;
  onSave: (draft: BudgetDocument) => Promise<boolean>;
  onClose: () => void;
};
function attempt(build: () => BudgetDocument) {
  try {
    return { draft: build(), error: null };
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : "Check your changes.",
    };
  }
}
async function save(props: Props, draft: BudgetDocument | null) {
  if (!draft || props.busy) return;
  if (await props.onSave(draft)) {
    Keyboard.dismiss();
    props.onClose();
  }
}
const classifications: { value: Classification; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Spending" },
  { value: "saving", label: "Savings" },
];

export function GroupEditor(
  props: Props & { group?: BudgetGroup; onDelete: () => void },
) {
  const [name, setName] = useState(props.group?.title ?? "");
  const [classification, setClassification] = useState<Classification>(
    props.group?.classification ?? "expense",
  );
  const preview = attempt(() =>
    editGroup(props.document, { title: name, classification }, props.group?.id),
  );
  return (
    <EditorSheet
      title={props.group ? "Edit group" : "Add a group"}
      busy={props.busy}
      onClose={props.onClose}
    >
      <Field
        label="Group name"
        value={name}
        onChange={setName}
        autoFocus
        disabled={props.busy}
      />
      <Choices
        label="Group type"
        value={classification}
        options={classifications}
        onChange={setClassification}
        disabled={props.busy}
      />
      <Note>
        Income adds money to the plan. Spending and savings reduce what is left
        to plan.
      </Note>
      <DraftPreview
        original={props.document}
        draft={preview.draft}
        error={name.trim() ? preview.error : null}
      />
      {props.error ? <Note>{props.error}</Note> : null}
      <Action
        label={props.busy ? "Saving…" : "Save group"}
        disabled={!preview.draft || props.busy}
        prominent
        onPress={() => void save(props, preview.draft)}
      />
      {props.group ? (
        <Action
          label="Delete group…"
          disabled={props.busy}
          onPress={props.onDelete}
        />
      ) : null}
    </EditorSheet>
  );
}

function amountInput(amount: number) {
  const magnitude = Math.abs(amount);
  return `${amount < 0 ? "-" : ""}${Math.trunc(magnitude / 100)}.${String(magnitude % 100).padStart(2, "0")}`;
}
export function RowEditor(
  props: Props & { row?: BudgetRow; groupId: string; onDelete: () => void },
) {
  const row = props.row;
  const choices = referenceChoices(props.document);
  const [label, setLabel] = useState(row?.label ?? "");
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [dueDay, setDueDay] = useState(row?.dueDay ? String(row.dueDay) : "");
  const [groupId, setGroupId] = useState(row?.groupId ?? props.groupId);
  const [kind, setKind] = useState<AmountRule["kind"]>(
    row?.rule.kind ?? "fixed",
  );
  const [fixed, setFixed] = useState(
    row?.rule.kind === "fixed" ? amountInput(row.rule.amountMinor) : "",
  );
  const [rate, setRate] = useState(
    row?.rule.kind === "percentage" ? row.rule.rate : "",
  );
  const [source, setSource] = useState(
    row?.rule.kind === "percentage"
      ? `${row.rule.source.kind}:${row.rule.source.id}`
      : "",
  );
  const [totalGroup, setTotalGroup] = useState(
    row?.rule.kind === "groupTotal" ? row.rule.groupId : "",
  );
  const [expression, setExpression] = useState(
    row?.rule.kind === "expression"
      ? expressionText(row.rule.expression, choices)
      : "",
  );
  const [role, setRole] = useState<AllocationRole>(
    row?.allocationRole ?? "allocation",
  );
  const [showReferences, setShowReferences] = useState(false);
  const references = choices.filter(
    (item) => !(item.reference.kind === "row" && item.reference.id === row?.id),
  );
  const preview = attempt(() => {
    let rule: AmountRule;
    if (kind === "fixed") rule = { kind, amountMinor: parseMoney(fixed) };
    else if (kind === "percentage") {
      const reference = choices.find(
        (item) => `${item.reference.kind}:${item.reference.id}` === source,
      )?.reference;
      if (!reference)
        throw new Error("Choose the row or group to take a percentage of.");
      if (!/^-?\d+(\.\d+)?$/.test(rate.trim()))
        throw new Error("Enter a percentage, such as 10 or 12.5.");
      rule = { kind, rate: rate.trim(), source: reference };
    } else if (kind === "groupTotal") {
      if (!totalGroup) throw new Error("Choose a group total.");
      rule = { kind, groupId: totalGroup };
    } else rule = { kind, expression: parseExpression(expression, choices) };
    return editRow(
      props.document,
      {
        label,
        notes,
        dueDay: dueDay.trim() === "" ? null : parseDueDay(dueDay),
        groupId,
        rule,
        allocationRole: role,
      },
      row?.id,
    );
  });
  return (
    <EditorSheet
      title={row ? "Edit row" : "Add a row"}
      busy={props.busy}
      onClose={props.onClose}
    >
      <Field
        label="Row name"
        value={label}
        onChange={setLabel}
        autoFocus={!row}
        disabled={props.busy}
      />
      <Choices
        label="Group"
        value={groupId}
        options={props.document.groups.map((group) => ({
          value: group.id,
          label: group.title,
        }))}
        onChange={setGroupId}
        disabled={props.busy}
      />
      <Choices
        label="Amount rule"
        value={kind}
        options={[
          { value: "fixed", label: "Fixed amount" },
          { value: "percentage", label: "Percentage" },
          { value: "groupTotal", label: "Group total" },
          { value: "expression", label: "Calculation" },
        ]}
        onChange={(value) => {
          setKind(value);
          if (value === "groupTotal") setRole("informational");
        }}
        disabled={props.busy}
      />
      {kind === "fixed" ? (
        <Field
          label="Amount in pounds"
          value={fixed}
          onChange={setFixed}
          numeric
          disabled={props.busy}
        />
      ) : null}
      {kind === "percentage" ? (
        <>
          <Field
            label="Percentage"
            value={rate}
            onChange={setRate}
            numeric
            disabled={props.busy}
          />
          <Choices
            label="Percentage of"
            value={source}
            options={references.map((item) => ({
              value: `${item.reference.kind}:${item.reference.id}`,
              label: item.label,
            }))}
            onChange={setSource}
            disabled={props.busy}
          />
        </>
      ) : null}
      {kind === "groupTotal" ? (
        <>
          <Choices
            label="Total of group"
            value={totalGroup}
            options={props.document.groups.map((group) => ({
              value: group.id,
              label: group.title,
            }))}
            onChange={setTotalGroup}
            disabled={props.busy}
          />
          <Note>
            Group totals start as display-only rows so the same money is not
            counted twice.
          </Note>
        </>
      ) : null}
      {kind === "expression" ? (
        <>
          <Field
            label="Calculation"
            value={expression}
            onChange={setExpression}
            multiline
            disabled={props.busy}
          />
          <Note>
            Use +, −, *, / and brackets. Numbers are pounds or multipliers, for
            example ([Salary · Income] - 500) * 0.1. Insert your own references
            below.
          </Note>
          <View style={editorStyles.wrap}>
            {["+", "-", "*", "/", "(", ")"].map((operator) => (
              <Action
                key={operator}
                label={operator}
                disabled={props.busy}
                onPress={() =>
                  setExpression((value) => `${value} ${operator} `)
                }
              />
            ))}
          </View>
          <Action
            label={showReferences ? "Hide references" : "Insert a row or group"}
            onPress={() => setShowReferences(!showReferences)}
            disabled={props.busy}
          />
          {showReferences
            ? references.map((item) => (
                <Action
                  key={`${item.reference.kind}:${item.reference.id}`}
                  label={`Insert ${item.label}`}
                  disabled={props.busy}
                  onPress={() => {
                    setExpression((value) => `${value}[${item.token}]`);
                    setShowReferences(false);
                  }}
                />
              ))
            : null}
        </>
      ) : null}
      <Choices
        label="Count in budget"
        value={role}
        options={[
          { value: "allocation", label: "Include in totals" },
          { value: "informational", label: "Display only" },
        ]}
        onChange={setRole}
        disabled={props.busy}
      />
      <Note>
        Display-only rows show a calculated figure without adding it to the
        group or monthly totals.
      </Note>
      <Field
        label="Payment day (optional)"
        value={dueDay}
        onChange={setDueDay}
        numeric
        disabled={props.busy}
      />
      <Note>
        Use a day from 1 to 31. In a shorter month it appears on the last day.
      </Note>
      <Field
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
        disabled={props.busy}
      />
      <DraftPreview
        original={props.document}
        draft={preview.draft}
        error={label.trim() ? preview.error : null}
      />
      {props.error ? <Note>{props.error}</Note> : null}
      <Action
        label={props.busy ? "Saving…" : "Save row"}
        disabled={!preview.draft || props.busy}
        prominent
        onPress={() => void save(props, preview.draft)}
      />
      {row ? (
        <Action
          label="Delete row…"
          disabled={props.busy}
          onPress={props.onDelete}
        />
      ) : null}
    </EditorSheet>
  );
}

function parseDueDay(value: string) {
  if (!/^\d+$/.test(value.trim()))
    throw new Error("Enter a payment day from 1 to 31.");
  const day = Number(value);
  if (day < 1 || day > 31) throw new Error("Enter a payment day from 1 to 31.");
  return day;
}

export function DeleteEditor(
  props: Props & {
    target: { kind: "row" | "group"; id: string; label: string };
  },
) {
  const { draft, affected, removedCount } = deletionDraft(
    props.document,
    props.target,
  );
  const blocked = affected.length > 0;
  return (
    <EditorSheet
      title={`Delete ${props.target.kind}`}
      busy={props.busy}
      onClose={props.onClose}
    >
      <Heading>{props.target.label}</Heading>
      <Note>
        {props.target.kind === "group"
          ? `This removes the group and its ${removedCount} ${removedCount === 1 ? "row" : "rows"} from this month.`
          : "This removes the row from this month."}
      </Note>
      {blocked ? (
        <>
          <Heading>Update these rules first</Heading>
          <Note>
            {affected.join(", ")} {affected.length === 1 ? "depends" : "depend"}{" "}
            on what you are deleting. Edit those rules before deleting so the
            budget still calculates correctly.
          </Note>
        </>
      ) : (
        <DraftPreview original={props.document} draft={draft} error={null} />
      )}
      {props.error ? <Note>{props.error}</Note> : null}
      <Action
        label={`Delete ${props.target.kind}`}
        disabled={blocked || props.busy}
        onPress={() => void save(props, draft)}
      />
      <Action label="Keep it" disabled={props.busy} onPress={props.onClose} />
    </EditorSheet>
  );
}

function movedIds(ids: string[], source: number, destination: number) {
  const next = [...ids];
  const [moved] = next.splice(source, 1);
  next.splice(source < destination ? destination - 1 : destination, 0, moved);
  return next;
}

export function ArrangeEditor(props: Props) {
  const [draft, setDraft] = useState(props.document);
  const [dragging, setDragging] = useState(false);
  const groups = [...draft.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <EditorSheet
      title="Arrange groups"
      busy={props.busy}
      onClose={props.onClose}
      scrollEnabled={!dragging}
    >
      <GroupReorderList
        disabled={props.busy}
        groups={groups}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}
        onReorder={(from, to) => {
          setDraft(
            reorderGroups(
              draft,
              movedIds(
                groups.map((group) => group.id),
                from,
                to,
              ),
            ),
          );
        }}
      />
      <DraftPreview original={props.document} draft={draft} error={null} />
      {props.error ? <Note>{props.error}</Note> : null}
      <Action
        label="Save order"
        disabled={props.busy}
        prominent
        onPress={() => void save(props, draft)}
      />
    </EditorSheet>
  );
}
