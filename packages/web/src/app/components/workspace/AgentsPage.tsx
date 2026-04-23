import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Hexagon, Plus, ShieldCheck, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { DashboardApi } from '../../../lib/api';
import { useAgents } from '../../../context/AgentsContext';
import { useAgentRuntime } from '../../../context/AgentRuntimeContext';
import { useWorkspaceSurface } from '../../context/WorkspaceSurfaceContext';
import { getAgentStatusVariant } from '../../workspace-data';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

type ActionLog = Awaited<ReturnType<typeof DashboardApi.listLogs>>['logs'][number];

const CyberAvatarSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M50 12 L66 26 V48 L50 62 L34 48 V26 Z" opacity="0.15" />
    <path d="M38 34 H62 V42 H38 Z" opacity="0.5" />
    <path d="M42 64 V74 H58 V64 Z" opacity="0.25" />
    <path d="M22 96 L32 72 H68 L78 96 Z" opacity="0.15" />
    <circle cx="50" cy="82" r="3" opacity="0.4" />
    <path d="M28 96 L46 82 H54 L72 96" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
    <path d="M50 12 V4" stroke="currentColor" strokeWidth="2" opacity="0.3" />
  </svg>
);

function buildLicenseId(agentId: string) {
  const compact = agentId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `A${compact.slice(-8).padStart(8, '0')}7604`;
}

function parseAgentMetadata(description: string | null | undefined, isShadow: boolean) {
  const fallbackRole = isShadow ? 'Shadow operator' : 'Registered agent';
  const trimmed = description?.trim() ?? '';

  if (!trimmed) {
    return { role: fallbackRole, description: '' };
  }

  const [role, ...rest] = trimmed.split(' - ');
  if (rest.length === 0) {
    return { role: fallbackRole, description: trimmed };
  }

  return {
    role: role.trim() || fallbackRole,
    description: rest.join(' - ').trim(),
  };
}

function serializeAgentMetadata(role: string, description: string) {
  return [role.trim(), description.trim()].filter(Boolean).join(' - ');
}

function statusForAgent(options: {
  agentId: string;
  runtimeAgentId?: string | null;
  isOnline: boolean;
  isShadow: boolean;
}) {
  if (options.runtimeAgentId === options.agentId) {
    return 'busy' as const;
  }
  if (options.isOnline || options.isShadow) {
    return 'ready' as const;
  }
  return 'offline' as const;
}

export function AgentsPage() {
  const {
    loading,
    error,
    agents,
    createAgent,
    updateAgent,
    deleteAgent,
    getAllowedLocations,
    setAllowedLocations,
    reloadAgents,
  } = useAgents();
  const runtime = useAgentRuntime();
  const { destinations, recordActivity } = useWorkspaceSurface();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [latestLog, setLatestLog] = useState<ActionLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const accessDestinations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; pluginName: string; icon: (typeof destinations)[number]['icon'] }>();
    destinations.forEach((destination) => {
      if (!destination.locationId || map.has(destination.locationId)) {
        return;
      }
      map.set(destination.locationId, {
        id: destination.locationId,
        name: destination.name,
        pluginName: destination.pluginName,
        icon: destination.icon,
      });
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [destinations]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId],
  );
  const selectedAgentStatus = selectedAgent
    ? statusForAgent({
      agentId: selectedAgent.id,
      runtimeAgentId: runtime.agentSession?.agentId,
      isOnline: selectedAgent.isOnline,
      isShadow: selectedAgent.isShadow,
    })
    : 'offline';
  const tokenId = selectedAgent ? buildLicenseId(selectedAgent.id) : 'PENDING';
  const stampRotationProfile = useMemo(() => Math.floor(Math.random() * 30) - 15, [selectedAgentId]);
  const stampRotationRegister = useMemo(() => Math.floor(Math.random() * 30) - 15, [isCreateOpen]);

  useEffect(() => {
    const requestedAgentId = searchParams.get('agent');
    if (requestedAgentId && agents.some((agent) => agent.id === requestedAgentId)) {
      setSelectedAgentId(requestedAgentId);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('agent');
        return next;
      }, { replace: true });
      return;
    }

    if (!selectedAgentId || !agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agents[0]?.id ?? null);
    }
  }, [agents, searchParams, selectedAgentId, setSearchParams]);

  useEffect(() => {
    if (!selectedAgent) {
      setDraftName('');
      setDraftRole('');
      setDraftDescription('');
      setSelectedLocationIds([]);
      setLatestLog(null);
      return;
    }

    const parsed = parseAgentMetadata(selectedAgent.description, selectedAgent.isShadow);
    setDraftName(selectedAgent.name);
    setDraftRole(parsed.role);
    setDraftDescription(parsed.description);

    void getAllowedLocations(selectedAgent.id)
      .then((allowedLocations) => {
        const allIds = accessDestinations.map((destination) => destination.id);
        const nextSelected = allowedLocations.length === 0
          ? allIds
          : allowedLocations.filter((locationId) => allIds.includes(locationId));
        setSelectedLocationIds(nextSelected);
      })
      .catch((nextError) => {
        setMessage(nextError instanceof Error ? nextError.message : 'Unable to load venue permissions.');
        setMessageTone('error');
      });

    void DashboardApi.listLogs(selectedAgent.id)
      .then((response) => {
        setLatestLog(response.logs[0] ?? null);
      })
      .catch(() => {
        setLatestLog(null);
      });
  }, [accessDestinations, getAllowedLocations, selectedAgent]);

  const showMessage = (text: string, tone: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageTone(tone);
  };

  const handleCopyId = async () => {
    if (!selectedAgent) {
      return;
    }
    await navigator.clipboard.writeText(selectedAgent.token ?? tokenId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = async () => {
    if (!selectedAgent) {
      return;
    }

    setSaving(true);
    try {
      await updateAgent(selectedAgent.id, {
        name: draftName.trim(),
        description: serializeAgentMetadata(draftRole, draftDescription),
      });
      recordActivity({
        category: 'agent',
        title: `${draftName.trim() || selectedAgent.name} updated`,
        summary: 'The agent identity record was updated from the registry.',
        tone: 'success',
        agentId: selectedAgent.id,
      });
      showMessage('Identity record updated.', 'success');
    } catch (nextError) {
      showMessage(nextError instanceof Error ? nextError.message : 'Unable to update identity record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTrustModeChange = async (value: 'confirm' | 'full') => {
    if (!selectedAgent) {
      return;
    }
    if (selectedAgent.isShadow) {
      showMessage('Shadow agent trust is fixed by the runtime.', 'info');
      return;
    }

    setSaving(true);
    try {
      await updateAgent(selectedAgent.id, { trustMode: value });
      showMessage('Trust clearance updated.', 'success');
    } catch (nextError) {
      showMessage(nextError instanceof Error ? nextError.message : 'Unable to update trust mode.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDestination = async (destinationId: string) => {
    if (!selectedAgent) {
      return;
    }

    const allIds = accessDestinations.map((destination) => destination.id);
    const nextSelected = selectedLocationIds.includes(destinationId)
      ? selectedLocationIds.filter((value) => value !== destinationId)
      : [...selectedLocationIds, destinationId];

    if (nextSelected.length === 0) {
      showMessage('At least one venue must remain allowed. Re-enable every venue to restore unrestricted access.', 'info');
      return;
    }

    setSelectedLocationIds(nextSelected);
    setSaving(true);
    try {
      await setAllowedLocations(selectedAgent.id, nextSelected.length === allIds.length ? [] : nextSelected);
      showMessage('Venue access updated.', 'success');
    } catch (nextError) {
      setSelectedLocationIds(selectedLocationIds);
      showMessage(nextError instanceof Error ? nextError.message : 'Unable to update venue access.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgent = async (name: string, role: string, description: string) => {
    setSaving(true);
    try {
      const nextAgent = await createAgent(name);
      await updateAgent(nextAgent.id, {
        description: serializeAgentMetadata(role, description),
      });
      setSelectedAgentId(nextAgent.id);
      setIsCreateOpen(false);
      recordActivity({
        category: 'agent',
        title: `${name} registered`,
        summary: 'A new identity record was issued from the registry.',
        tone: 'success',
        agentId: nextAgent.id,
      });
      showMessage('Identity registered.', 'success');
      return true;
    } catch (nextError) {
      showMessage(nextError instanceof Error ? nextError.message : 'Unable to register identity.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) {
      return;
    }
    if (agent.isShadow) {
      showMessage('The shadow identity cannot be revoked.', 'error');
      return;
    }

    setSaving(true);
    try {
      await deleteAgent(agentId);
      recordActivity({
        category: 'agent',
        title: `${agent.name} revoked`,
        summary: 'The identity record was permanently removed from the registry.',
        tone: 'warning',
        agentId,
      });
      showMessage('Identity revoked.', 'success');
      setAgentToDelete(null);
    } catch (nextError) {
      showMessage(nextError instanceof Error ? nextError.message : 'Unable to revoke identity.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    if (!selectedAgent) {
      return;
    }

    setSaving(true);
    try {
      await DashboardApi.uploadAgentAvatar(selectedAgent.id, file);
      await reloadAgents();
      showMessage('Identity photo uploaded.', 'success');
    } catch (nextError) {
      showMessage(nextError instanceof Error ? nextError.message : 'Unable to upload identity photo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedAgent && !loading) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 p-4 md:p-6 xl:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Identity Registry</h1>
          </div>
        </div>
      </div>
    );
  }

  const lastPresenceLabel = latestLog
    ? new Date(latestLog.createdAt).toLocaleString()
    : selectedAgent?.isOnline
      ? 'Live now'
      : 'No recorded activity';

  return (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleUploadAvatar(file);
          }
          event.target.value = '';
        }}
      />

      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 p-4 md:p-6 xl:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Identity Registry</h1>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Register Identity
          </Button>
        </div>

        {message ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            messageTone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              : messageTone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300'
          }`}>
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {selectedAgent ? (
          <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <Card className="min-h-0 flex flex-col border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <CardHeader className="shrink-0 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <CardTitle className="text-base font-medium">Registered Identities</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-0 pt-0">
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-4">
                    {agents.map((agent) => {
                      const agentStatus = statusForAgent({
                        agentId: agent.id,
                        runtimeAgentId: runtime.agentSession?.agentId,
                        isOnline: agent.isOnline,
                        isShadow: agent.isShadow,
                      });
                      const metadata = parseAgentMetadata(agent.description, agent.isShadow);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => setSelectedAgentId(agent.id)}
                          className={`flex w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                            selectedAgent.id === agent.id
                              ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                              : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-950'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-3">
                            <div>
                              <div className="font-medium">{agent.name}</div>
                              <div className={`mt-1 text-xs ${selectedAgent.id === agent.id ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                {metadata.role}
                              </div>
                            </div>
                            <Badge variant={getAgentStatusVariant(agentStatus)} className="capitalize">
                              {agentStatus}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="min-h-0 flex flex-col border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <CardHeader className="shrink-0 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-semibold">{selectedAgent.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAgent.isShadow ? (
                      <Badge variant="success">
                        <ShieldCheck className="mr-1 size-3.5" />
                        Primary
                      </Badge>
                    ) : null}
                    <Badge variant={getAgentStatusVariant(selectedAgentStatus)} className="capitalize">
                      {selectedAgentStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col pt-6">
                <Tabs defaultValue="profile" className="flex min-h-0 flex-1 flex-col">
                  <TabsList className="h-auto w-fit shrink-0 flex-wrap rounded-2xl p-1">
                    <TabsTrigger value="profile">Identity Profile</TabsTrigger>
                    <TabsTrigger value="access">City Access</TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile" className="flex min-h-0 flex-1 flex-col data-[state=active]:flex">
                    <ScrollArea className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex flex-col gap-8 p-5 xl:flex-row">
                        <div className="w-full shrink-0 xl:w-[500px]">
                          <div className="relative aspect-[1.58/1] flex flex-col overflow-hidden rounded-xl border border-zinc-300/50 bg-zinc-50 shadow-[0px_10px_30px_-5px_rgba(0,0,0,0.1)] transition-all dark:border-zinc-700/50 dark:bg-zinc-950">
                            <div
                              className="pointer-events-none absolute top-0 left-0 h-32 w-full select-none text-zinc-900 opacity-[0.03] dark:text-white dark:opacity-[0.05]"
                              style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                            />

                            <div className="pointer-events-none absolute top-0 left-0 flex w-full select-none items-center justify-between px-5 pt-3 text-zinc-800 opacity-50 dark:text-zinc-300">
                              <div className="flex items-center gap-1">
                                <div className="h-1 w-8 bg-current" />
                                <div className="h-1 w-2 bg-current" />
                                <div className="h-1 w-1 bg-current" />
                                <div className="h-1 w-4 bg-current" />
                              </div>
                              <div className="font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                                ID: {tokenId}
                              </div>
                            </div>

                            <div className="absolute top-3 left-3 size-2 border-t border-l border-zinc-400 opacity-60 dark:border-zinc-500" />
                            <div className="absolute top-3 right-3 size-2 border-t border-r border-zinc-400 opacity-60 dark:border-zinc-500" />
                            <div className="absolute bottom-3 left-3 size-2 border-b border-l border-zinc-400 opacity-60 dark:border-zinc-500" />
                            <div className="absolute bottom-3 right-3 size-2 border-b border-r border-zinc-400 opacity-60 dark:border-zinc-500" />
                            <div className="pointer-events-none absolute right-[-46px] top-[100px] rotate-90 select-none text-[7px] font-mono font-bold tracking-[0.4em] text-zinc-300 dark:text-zinc-700">
                              DATA_NODE_SECURE
                            </div>

                            <div className="relative z-10 mt-7 flex w-full flex-col items-center justify-center text-zinc-900 dark:text-zinc-100">
                              <div className="mb-1 flex items-center gap-3 opacity-80">
                                <div className="h-px w-12 bg-gradient-to-r from-transparent to-current" />
                                <Hexagon className="size-4" />
                                <div className="h-px w-12 bg-gradient-to-l from-transparent to-current" />
                              </div>
                              <span className="font-serif text-3xl font-black uppercase tracking-[0.15em]">URUC CITY</span>
                              <span className="mt-1 font-sans text-[9px] font-bold uppercase tracking-[0.3em] opacity-60">MUNICIPAL AGENT LICENSE</span>
                            </div>

                            <div className="flex flex-1 gap-4 px-6 pt-2 pb-6">
                              <div className="relative z-10 flex w-32 shrink-0 flex-col gap-2">
                                <span className="pl-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">EXPIRES: NEVER</span>
                                <button
                                  type="button"
                                  className="group relative flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-zinc-300 bg-zinc-100/50 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                                  onClick={() => avatarInputRef.current?.click()}
                                >
                                  {selectedAgent.avatarPath ? (
                                    <img
                                      src={selectedAgent.avatarPath}
                                      alt={`${selectedAgent.name} avatar`}
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  ) : (
                                    <CyberAvatarSVG className="pointer-events-none absolute inset-0 m-auto size-[85%] text-zinc-400 dark:text-zinc-600" />
                                  )}
                                  <div className="relative z-10 flex h-full w-full items-center justify-center bg-white/0 transition-colors group-hover:bg-white/10 dark:group-hover:bg-black/10">
                                    <Upload className="size-6 text-zinc-400 drop-shadow-sm transition-colors group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300" />
                                  </div>
                                </button>
                              </div>

                              <div className="relative flex flex-1 flex-col gap-1 pt-1">
                                <div className="relative z-10 -ml-8 flex w-full items-center justify-center">
                                  <span className="font-mono text-2xl font-bold tracking-widest text-zinc-900 dark:text-zinc-100">
                                    {tokenId}
                                  </span>
                                  <button onClick={() => void handleCopyId()} className="absolute right-0 rounded p-1 opacity-50 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
                                    {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3 text-zinc-600 dark:text-zinc-400" />}
                                  </button>
                                </div>

                                <div className="relative z-10 mt-2 flex flex-col gap-1">
                                  <div className="flex items-center">
                                    <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Name:</span>
                                    <input
                                      className="h-7 w-full bg-transparent px-0 font-[cursive] text-xl font-medium italic tracking-wide text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                                      value={draftName}
                                      onChange={(event) => setDraftName(event.target.value)}
                                      placeholder="Name"
                                    />
                                  </div>
                                  <div className="flex items-center">
                                    <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Role:</span>
                                    <input
                                      className="h-6 w-full bg-transparent px-0 font-[cursive] text-sm font-medium italic tracking-wide text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-300"
                                      value={draftRole}
                                      onChange={(event) => setDraftRole(event.target.value)}
                                      placeholder="Role"
                                    />
                                  </div>
                                  <div className="mt-1 flex items-start">
                                    <span className="w-12 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bio:</span>
                                    <textarea
                                      className="h-10 w-full resize-none bg-transparent px-0 font-[cursive] text-sm font-medium italic tracking-wide text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-300"
                                      value={draftDescription}
                                      onChange={(event) => setDraftDescription(event.target.value)}
                                      placeholder="Bio"
                                    />
                                  </div>
                                </div>

                                <div
                                  className="pointer-events-none absolute right-2 bottom-6 flex select-none flex-col items-center justify-center border-[3px] border-red-600 px-3 py-1 opacity-[0.25] mix-blend-multiply dark:border-red-500 dark:mix-blend-screen"
                                  style={{ transform: `rotate(${stampRotationProfile}deg)` }}
                                >
                                  <span className="font-mono text-xl leading-none font-black tracking-[0.1em] text-red-600 dark:text-red-500">URUC VERIFIED</span>
                                  <span className="mt-0.5 font-mono text-[8px] font-bold tracking-[0.3em] text-red-600 dark:text-red-500">SYS.REGISTRY</span>
                                </div>

                                <div className="absolute bottom-0 left-0 flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                  <span>TRUST: {selectedAgent.trustMode}</span>
                                  <span>STATUS: {selectedAgentStatus}</span>
                                  <span>VENUES: {selectedLocationIds.length}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 flex justify-end gap-3">
                            <Button
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                              onClick={() => {
                                if (selectedAgent.isShadow) {
                                  showMessage('The shadow identity cannot be revoked.', 'error');
                                  return;
                                }
                                setAgentToDelete(selectedAgent.id);
                              }}
                            >
                              Revoke License
                            </Button>
                            <Button disabled={saving} onClick={() => void handleSaveProfile()}>
                              Update Identity Record
                            </Button>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-6">
                          <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                            <div>
                              <div className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">Trust clearance</div>
                            </div>
                            <Select
                              value={selectedAgent.trustMode}
                              onValueChange={(value) => void handleTrustModeChange(value as 'confirm' | 'full')}
                            >
                              <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900">
                                <SelectValue placeholder="Choose trust mode" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="confirm">Require Confirmation</SelectItem>
                                <SelectItem value="full">Full Trust</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Last presence</div>
                              <div className="mt-2 font-mono text-sm font-bold text-zinc-900 dark:text-white">{lastPresenceLabel}</div>
                              {latestLog?.detail ? (
                                <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                  {latestLog.detail}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="access" className="mt-4 flex min-h-0 flex-1 flex-col data-[state=active]:flex">
                    <ScrollArea className="min-w-0 w-full flex-1 rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="p-5">
                        <div className="max-w-2xl">
                          <div className="text-sm font-medium">Allowed destinations</div>
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {accessDestinations.map((destination) => {
                            const allowed = selectedLocationIds.includes(destination.id);
                            return (
                              <button
                                key={destination.id}
                                type="button"
                                onClick={() => void handleToggleDestination(destination.id)}
                                className={`rounded-2xl border p-4 text-left transition-colors ${
                                  allowed
                                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`flex size-10 items-center justify-center rounded-xl border ${
                                      allowed
                                        ? 'border-white/20 bg-white/10 dark:border-zinc-300 dark:bg-zinc-200'
                                        : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
                                    }`}>
                                      <destination.icon className="size-4" />
                                    </div>
                                    <div>
                                      <div className="font-medium">{destination.name}</div>
                                      <div className={`mt-1 text-xs ${allowed ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                        {destination.pluginName}
                                      </div>
                                    </div>
                                  </div>
                                  <Badge variant={allowed ? 'success' : 'secondary'}>
                                    {allowed ? 'Allowed' : 'Blocked'}
                                  </Badge>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg overflow-hidden border-0 bg-transparent p-0 shadow-none">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const name = String(form.get('name') ?? '').trim();
              const role = String(form.get('role') ?? '').trim();
              const description = String(form.get('description') ?? '').trim();
              if (!name || !role || !description) {
                return;
              }
              void handleCreateAgent(name, role, description).then((created) => {
                if (created) {
                  event.currentTarget.reset();
                }
              });
            }}
          >
            <div className="relative flex aspect-[1.58/1] flex-col overflow-hidden rounded-xl border border-zinc-300/50 bg-zinc-50 shadow-[0px_20px_40px_-10px_rgba(0,0,0,0.2)] transition-all dark:border-zinc-700/50 dark:bg-zinc-950">
              <div
                className="pointer-events-none absolute top-0 left-0 h-32 w-full select-none text-zinc-900 opacity-[0.03] dark:text-white dark:opacity-[0.05]"
                style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px' }}
              />

              <div className="pointer-events-none absolute top-0 left-0 flex w-full select-none items-center justify-between px-5 pt-3 text-zinc-800 opacity-50 dark:text-zinc-300">
                <div className="flex items-center gap-1">
                  <div className="h-1 w-8 bg-current" />
                  <div className="h-1 w-2 bg-current" />
                  <div className="h-1 w-1 bg-current" />
                  <div className="h-1 w-4 bg-current" />
                </div>
                <div className="font-mono text-[7px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  ID: PENDING_AUTH
                </div>
              </div>

              <div className="absolute top-3 left-3 size-2 border-t border-l border-zinc-400 opacity-60 dark:border-zinc-500" />
              <div className="absolute top-3 right-3 size-2 border-t border-r border-zinc-400 opacity-60 dark:border-zinc-500" />
              <div className="absolute bottom-3 left-3 size-2 border-b border-l border-zinc-400 opacity-60 dark:border-zinc-500" />
              <div className="absolute bottom-3 right-3 size-2 border-b border-r border-zinc-400 opacity-60 dark:border-zinc-500" />
              <div className="pointer-events-none absolute right-[-46px] top-[100px] rotate-90 select-none text-[7px] font-mono font-bold tracking-[0.4em] text-zinc-300 dark:text-zinc-700">
                DATA_NODE_SECURE
              </div>

              <div className="relative z-10 mt-7 flex w-full flex-col items-center justify-center text-zinc-900 dark:text-zinc-100">
                <div className="mb-1 flex items-center gap-3 opacity-80">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent to-current" />
                  <Hexagon className="size-4" />
                  <div className="h-px w-12 bg-gradient-to-l from-transparent to-current" />
                </div>
                <span className="font-serif text-3xl font-black uppercase tracking-[0.15em]">URUC CITY</span>
                <span className="mt-1 font-sans text-[9px] font-bold uppercase tracking-[0.3em] opacity-60">MUNICIPAL AGENT LICENSE</span>
              </div>

              <div className="flex flex-1 gap-4 px-6 pt-2 pb-6">
                <div className="relative z-10 flex w-32 shrink-0 flex-col gap-2">
                  <span className="pl-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">EXPIRES: NEVER</span>
                  <div className="group relative flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-zinc-300 bg-zinc-100/50 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-zinc-600 dark:hover:bg-zinc-900">
                    <CyberAvatarSVG className="pointer-events-none absolute inset-0 m-auto size-[85%] text-zinc-400 dark:text-zinc-600" />
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <Upload className="size-5 text-zinc-400 drop-shadow-sm transition-colors group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300" />
                      <span className="px-2 text-center text-[8px] font-bold uppercase text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-300">Attach Photo</span>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-1 flex-col gap-1 pt-1">
                  <div className="relative z-10 -ml-8 flex w-full items-center justify-center">
                    <span className="font-mono text-2xl font-bold tracking-widest text-zinc-900 opacity-30 dark:text-zinc-100">
                      PENDING
                    </span>
                  </div>

                  <div className="relative z-10 mt-2 flex flex-col gap-1">
                    <div className="flex items-center border-b border-zinc-300/50 pb-1 dark:border-zinc-700/50">
                      <label htmlFor="create-name" className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Name:</label>
                      <input
                        id="create-name"
                        name="name"
                        required
                        autoComplete="off"
                        className="h-7 w-full bg-transparent px-0 font-[cursive] text-xl font-medium italic tracking-wide text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-600"
                        placeholder="E.g. Nexus Protocol"
                      />
                    </div>
                    <div className="mt-1 flex items-center border-b border-zinc-300/50 pb-1 dark:border-zinc-700/50">
                      <label htmlFor="create-role" className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Role:</label>
                      <input
                        id="create-role"
                        name="role"
                        required
                        autoComplete="off"
                        className="h-6 w-full bg-transparent px-0 font-[cursive] text-sm font-medium italic tracking-wide text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-300 dark:placeholder:text-zinc-600"
                        placeholder="E.g. Monitor"
                      />
                    </div>
                    <div className="mt-2 flex items-start">
                      <label htmlFor="create-bio" className="w-12 shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bio:</label>
                      <textarea
                        id="create-bio"
                        name="description"
                        required
                        className="h-10 w-full resize-none bg-transparent px-0 font-[cursive] text-sm font-medium italic tracking-wide text-zinc-800 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-300 dark:placeholder:text-zinc-600"
                        placeholder="Primary directives."
                      />
                    </div>
                  </div>

                  <div
                    className="pointer-events-none absolute right-2 bottom-6 flex select-none flex-col items-center justify-center border-[3px] border-dashed border-red-600 px-3 py-1 opacity-[0.15] mix-blend-multiply dark:border-red-500 dark:mix-blend-screen"
                    style={{ transform: `rotate(${stampRotationRegister}deg)` }}
                  >
                    <span className="font-mono text-lg leading-none font-black tracking-[0.1em] text-red-600 dark:text-red-500">URUC DRAFT</span>
                    <span className="mt-0.5 font-mono text-[6px] font-bold tracking-[0.3em] text-red-600 dark:text-red-500">UNSIGNED</span>
                  </div>

                  <div className="absolute bottom-0 left-0 flex w-full items-center justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <div className="flex gap-4">
                      <span>TRUST: PEND</span>
                      <span>STATUS: INIT</span>
                    </div>
                    <button type="submit" className="rounded bg-zinc-900 px-3 py-1 text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                      Stamp &amp; Issue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!agentToDelete} onOpenChange={(open) => !open && setAgentToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Revoke Agent License?</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              This will permanently delete the agent&apos;s identity record and revoke all city access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAgentToDelete(null)}>Cancel</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              onClick={() => {
                if (agentToDelete) {
                  void handleDeleteAgent(agentToDelete);
                }
              }}
            >
              Confirm Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
