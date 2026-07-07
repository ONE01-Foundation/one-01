/**
 * Mock units — from ONE_DATA_MODEL_AND_EXAMPLES §3-§4.
 * Five canonical processes for the MVP demo:
 *   1. Weight Gain (Ariel, fitness/health)
 *   2. Driving License (Ariel, learning)
 *   3. Move Apartment (Ariel, home)
 *   4. Business Website (ONE01, business)
 *   5. Injury Claim (Ariel, legal)
 */

import type { Unit } from '../../core/mvp/types';

const ARIEL = 'identity_ariel';
const ONE01 = 'identity_one01';
const NOW = '2026-06-23T08:00:00.000Z';

// Static per-unit timestamps so the small card always shows the spec's example
// times ("14:20", "12:34", "Yesterday") regardless of when the demo is rendered.
// Otherwise every card stamps the same wall-clock minute and looks fake.
const TS_WEIGHT_GAIN   = '2026-06-23T14:20:00.000Z';  // 14:20 today
const TS_DRIVING       = '2026-06-23T12:34:00.000Z';  // 12:34 today
const TS_MOVE          = '2026-06-22T10:00:00.000Z';  // → "Yesterday"
const TS_WEBSITE       = '2026-06-23T13:50:00.000Z';  // 13:50 today
const TS_INJURY        = '2026-06-23T08:10:00.000Z';  // 08:10 today
const TS_BOOKING       = '2026-06-23T09:12:00.000Z';  // 09:12 today

export const MOCK_UNITS: Unit[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 1. Weight Gain
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'unit_weight_gain',
    identityId: ARIEL,
    title: 'Weight Gain',
    emoji: '💪',
    tagIds: ['fitness', 'health'],
    color: '#10B981',
    broadcast: [
      {
        id: 'b_wg_1',
        text: 'Next workout today at 2:00 PM.',
        priority: 90,
        type: 'event',
        createdAt: NOW,
      },
      {
        id: 'b_wg_2',
        text: 'Protein goal reached yesterday.',
        priority: 60,
        type: 'progress',
        createdAt: NOW,
      },
    ],
    latestBroadcastText: [
      'Next workout today at 2:00 PM.',
      'Protein goal reached yesterday.',
    ],
    lastUpdatedAt: TS_WEIGHT_GAIN,
    unreadUpdates: 2,
    relationLabel: 'Coach Eli +1',
    visibility: 'shared',
    progress: { current: 21, total: 32, label: 'workouts' },
    metrics: [
      { id: 'm_w_weight', label: 'Weight', value: '72', unit: 'kg' },
      { id: 'm_w_goal', label: 'Goal', value: '78', unit: 'kg' },
      { id: 'm_w_progress', label: 'Progress', value: '+3', unit: 'kg' },
      { id: 'm_w_calories', label: 'Calories', value: '3600' },
      { id: 'm_w_protein', label: 'Protein', value: '160', unit: 'g' },
      { id: 'm_w_workouts', label: 'Workouts', value: '21' },
      { id: 'm_w_sleep', label: 'Sleep', value: '7.5', unit: 'h' },
      { id: 'm_w_streak', label: 'Streak', value: '14', unit: 'days' },
    ],
    quickActions: [
      { id: 'qa_w_log', label: 'Log Weight', actionType: 'log_weight' },
      { id: 'qa_w_cal', label: 'Calories', actionType: 'add_calories' },
      { id: 'qa_w_workout', label: 'Workout', actionType: 'start_workout' },
      { id: 'qa_w_meal', label: 'Meal', actionType: 'add_meal' },
    ],
    nextSteps: [
      { id: 'ns_w_1', title: "Today's workout", subtitle: 'Upper body' },
      { id: 'ns_w_2', title: "Record today's weight" },
      { id: 'ns_w_3', title: 'Buy protein powder', done: true },
      { id: 'ns_w_4', title: "Prepare tomorrow's meals" },
      { id: 'ns_w_5', title: 'Reach 73 kg milestone' },
      { id: 'ns_w_6', title: 'Book trainer session' },
    ],
    people: [
      { id: 'p_eli', name: 'Coach Eli', role: 'Trainer', connectionType: 'coach' },
      { id: 'p_partner', name: 'Training Partner', connectionType: 'partner' },
      { id: 'p_nut', name: 'Nutritionist', connectionType: 'provider' },
    ],
    insights: [
      { id: 'i_w_1', text: 'Weight increased by 1 kg in the last month.', createdAt: NOW },
      { id: 'i_w_2', text: 'Most successful weeks include 4 workouts.', createdAt: NOW },
      { id: 'i_w_3', text: 'Training consistency is 82%.', createdAt: NOW },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Driving License
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'unit_driving_license',
    identityId: ARIEL,
    title: 'Driving License',
    emoji: '🚗',
    tagIds: ['learning'],
    color: '#8B5CF6',
    broadcast: [
      {
        id: 'b_dl_1',
        text: 'Next lesson is scheduled for Tuesday.',
        priority: 80,
        type: 'event',
        createdAt: NOW,
      },
      {
        id: 'b_dl_2',
        text: 'The next step is preparing for the test.',
        priority: 60,
        type: 'next_step',
        createdAt: NOW,
      },
    ],
    latestBroadcastText: [
      'Next lesson is scheduled for Tuesday.',
      'The next step is preparing for the test.',
    ],
    lastUpdatedAt: TS_DRIVING,
    unreadUpdates: 2,
    relationLabel: 'Instructor Eli',
    visibility: 'private',
    progress: { current: 5, total: 8, label: 'lessons' },
    quickActions: [
      { id: 'qa_dl_lesson', label: 'Lesson', actionType: 'schedule' },
      { id: 'qa_dl_test', label: 'Test', actionType: 'schedule' },
      { id: 'qa_dl_inst', label: 'Instructor', actionType: 'note' },
      { id: 'qa_dl_pay', label: 'Payment', actionType: 'payment' },
    ],
    nextSteps: [
      { id: 'ns_dl_1', title: 'Complete 6th driving lesson' },
      { id: 'ns_dl_2', title: 'Schedule the theory test' },
      { id: 'ns_dl_3', title: 'Pay remaining instructor balance' },
    ],
    people: [{ id: 'p_inst_eli', name: 'Instructor Eli', connectionType: 'provider' }],
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Move Apartment
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'unit_move_apartment',
    identityId: ARIEL,
    title: 'Move Apartment',
    emoji: '🏠',
    tagIds: ['home'],
    color: '#3B82F6',
    broadcast: [
      {
        id: 'b_ma_1',
        text: "Waiting for the architect's approval.",
        priority: 70,
        type: 'waiting',
        createdAt: NOW,
      },
      {
        id: 'b_ma_2',
        text: 'Kitchen measurements are still missing.',
        priority: 60,
        type: 'missing_info',
        createdAt: NOW,
      },
    ],
    latestBroadcastText: [
      "Waiting for the architect's approval.",
      'Kitchen measurements are still missing.',
    ],
    lastUpdatedAt: TS_MOVE,
    unreadUpdates: 0,
    relationLabel: 'Shared +2',
    visibility: 'shared',
    progress: { current: 4, total: 9 },
    quickActions: [
      { id: 'qa_ma_pay', label: 'Payment', actionType: 'payment' },
      { id: 'qa_ma_doc', label: 'Document', actionType: 'upload' },
      { id: 'qa_ma_sup', label: 'Supplier', actionType: 'note' },
      { id: 'qa_ma_photo', label: 'Photo', actionType: 'upload' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Business Website  (under ONE01 business identity)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'unit_business_website',
    identityId: ONE01,
    title: 'Business Website',
    emoji: '💼',
    tagIds: ['business'],
    color: '#4B5563',
    broadcast: [
      {
        id: 'b_bw_1',
        text: 'The landing page is almost ready.',
        priority: 80,
        type: 'progress',
        createdAt: NOW,
      },
      {
        id: 'b_bw_2',
        text: 'Payment flow still needs to be connected.',
        priority: 70,
        type: 'next_step',
        createdAt: NOW,
      },
    ],
    latestBroadcastText: [
      'The landing page is almost ready.',
      'Payment flow still needs to be connected.',
    ],
    lastUpdatedAt: TS_WEBSITE,
    unreadUpdates: 3,
    relationLabel: 'ONE01 Team',
    visibility: 'shared',
    progress: { current: 8, total: 12 },
    quickActions: [
      { id: 'qa_bw_task', label: 'Task', actionType: 'note' },
      { id: 'qa_bw_design', label: 'Design', actionType: 'upload' },
      { id: 'qa_bw_copy', label: 'Copy', actionType: 'note' },
      { id: 'qa_bw_pub', label: 'Publish', actionType: 'custom' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 4b. Booking Request  (incoming from a customer's ONE — the provider side)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'unit_booking_yael',
    identityId: ONE01,
    title: 'Booking Request — Yael R.',
    emoji: '📅',
    tagIds: ['business'],
    color: '#4B5563',
    broadcast: [
      {
        id: 'b_by_1',
        text: "Yael's ONE requested a haircut for Wed 16:30.",
        priority: 88,
        type: 'event',
        createdAt: NOW,
      },
      {
        id: 'b_by_2',
        text: 'Awaiting your confirmation.',
        priority: 75,
        type: 'next_step',
        createdAt: NOW,
      },
    ],
    latestBroadcastText: [
      "Yael's ONE requested a haircut for Wed 16:30.",
      'Awaiting your confirmation.',
    ],
    lastUpdatedAt: TS_BOOKING,
    unreadUpdates: 2,
    relationLabel: 'Yael R.',
    visibility: 'shared',
    progress: { current: 1, total: 3, label: 'steps' },
    metrics: [
      { id: 'm_by_service', label: 'Service', value: 'Haircut' },
      { id: 'm_by_when', label: 'Requested', value: 'Wed 16:30' },
      { id: 'm_by_client', label: 'Client', value: 'Yael R.' },
      { id: 'm_by_status', label: 'Status', value: 'Pending' },
    ],
    quickActions: [
      { id: 'qa_by_confirm', label: 'Confirm', actionType: 'schedule' },
      { id: 'qa_by_propose', label: 'Propose time', actionType: 'custom' },
      { id: 'qa_by_message', label: 'Message', actionType: 'note' },
    ],
    nextSteps: [
      { id: 'ns_by_1', title: 'Request received', done: true },
      { id: 'ns_by_2', title: 'Confirm the time' },
      { id: 'ns_by_3', title: 'Send calendar hold' },
    ],
    people: [{ id: 'p_yael', name: 'Yael R.', role: 'Client', connectionType: 'client' }],
    insights: [
      {
        id: 'i_by_1',
        text: 'Yael is a returning client — 4 visits this year.',
        createdAt: NOW,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Injury Claim
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'unit_injury_claim',
    identityId: ARIEL,
    title: 'Injury Claim',
    emoji: '⚖️',
    tagIds: ['legal'],
    color: '#6366F1',
    broadcast: [
      {
        id: 'b_ic_1',
        text: 'Your lawyer is waiting for the medical report.',
        priority: 75,
        type: 'waiting',
        createdAt: NOW,
      },
      {
        id: 'b_ic_2',
        text: 'One document is still missing.',
        priority: 65,
        type: 'missing_info',
        createdAt: NOW,
      },
    ],
    latestBroadcastText: [
      'Your lawyer is waiting for the medical report.',
      'One document is still missing.',
    ],
    lastUpdatedAt: TS_INJURY,
    unreadUpdates: 1,
    relationLabel: 'Lawyer Cohen',
    visibility: 'private',
    progress: { current: 3, total: 7 },
    quickActions: [
      { id: 'qa_ic_doc', label: 'Document', actionType: 'upload' },
      { id: 'qa_ic_note', label: 'Note', actionType: 'note' },
      { id: 'qa_ic_pay', label: 'Payment', actionType: 'payment' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];
