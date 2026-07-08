import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldMinus, UserPlus } from 'lucide-react';
import Modal from '../common/Modal.jsx';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import FloatingLabelInput from '../common/FloatingLabelInput.jsx';
import Spinner from '../common/Spinner.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useUiStore } from '../../store/uiStore.js';
import { useChatStore } from '../../store/chatStore.js';
import { compressImage } from '../../services/imageCompression.js';
import { uploadObject } from '../../services/uploadHelpers.js';
import { updateGroupChat, promoteGroupAdmin, demoteGroupAdmin, getChats } from '../../services/api.js';

// Visible to any group participant (the "Group info" trigger in ChatHeader has no role gate),
// but edit/promote/demote controls are gated per-role inside — leader/admin for name+avatar+add
// member, leader-only for promote/demote, matching chats.controller.js's server-side rules.
export default function GroupInfoModal({ chat }) {
  const isOpen = useUiStore((s) => s.activeModal === 'group-info');
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [name, setName] = useState(chat?.groupName ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [roleActionId, setRoleActionId] = useState(null);

  useEffect(() => {
    if (isOpen) setName(chat?.groupName ?? '');
  }, [isOpen, chat?.groupName]);

  if (!chat?.isGroup) return null;

  const leaderId = String(chat.groupAdmins?.[0] ?? '');
  const adminIds = new Set((chat.groupAdmins || []).map(String));
  const isLeader = leaderId === user.id;
  const isAdmin = adminIds.has(user.id);

  const refreshChats = async () => {
    const refreshed = await getChats();
    useChatStore.getState().setChats(refreshed);
  };

  const handleSaveName = async () => {
    if (!name.trim() || name === chat.groupName) return;
    setSaving(true);
    try {
      await updateGroupChat(chat.id, { groupName: name.trim() });
      await refreshChats();
      toast.success('Group name updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update group name');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const objectKey = await uploadObject('photo', compressed);
      await updateGroupChat(chat.id, { groupAvatarUrl: objectKey });
      await refreshChats();
      toast.success('Group photo updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePromote = async (memberId) => {
    setRoleActionId(memberId);
    try {
      await promoteGroupAdmin(chat.id, memberId);
      await refreshChats();
      toast.success('Member promoted to admin');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to promote member');
    } finally {
      setRoleActionId(null);
    }
  };

  const handleDemote = async (memberId) => {
    setRoleActionId(memberId);
    try {
      await demoteGroupAdmin(chat.id, memberId);
      await refreshChats();
      toast.success('Admin demoted');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to demote admin');
    } finally {
      setRoleActionId(null);
    }
  };

  const roleLabel = (memberId) => {
    if (memberId === leaderId) return 'Leader';
    if (adminIds.has(memberId)) return 'Admin';
    return 'Member';
  };

  return (
    <Modal id="group-info" title="Group info" panelClassName="bg-panel-detail">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar
            size="xl"
            src={chat.groupAvatarUrl}
            name={chat.groupName}
            onClick={isAdmin ? () => fileInputRef.current?.click() : undefined}
          />
          {uploadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Spinner size="md" />
            </div>
          )}
          {isAdmin && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          )}
        </div>
        <div className="flex-1">
          {isAdmin ? (
            <FloatingLabelInput
              id="group-name"
              label="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <h2 className="font-display text-lg font-semibold text-ink">{chat.groupName}</h2>
          )}
        </div>
      </div>

      {isAdmin && (
        <Button
          variant="gradient"
          className="mt-3 w-full"
          disabled={!name.trim() || name === chat.groupName}
          loading={saving}
          onClick={handleSaveName}
        >
          Save name
        </Button>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Members</h3>
        {isAdmin && (
          <button
            type="button"
            onClick={() => useUiStore.getState().openModal('add-member')}
            className="icon-btn flex items-center gap-1 text-sm text-primary-600"
          >
            <UserPlus className="h-4 w-4" />
            Add member
          </button>
        )}
      </div>

      <ul className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
        {(chat.participants || []).map((member) => {
          const memberId = String(member._id);
          const isMemberLeader = memberId === leaderId;
          const isMemberAdmin = adminIds.has(memberId);
          return (
            <li key={memberId} className="flex items-center gap-3 py-1">
              <Avatar src={member.profileImageUrl} name={member.name} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{member.name}</div>
                <div className="text-xs text-ink-muted">{roleLabel(memberId)}</div>
              </div>
              {isLeader && !isMemberLeader && (
                <button
                  type="button"
                  disabled={roleActionId === memberId}
                  onClick={() => (isMemberAdmin ? handleDemote(memberId) : handlePromote(memberId))}
                  className="icon-btn flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                >
                  {isMemberAdmin ? (
                    <>
                      <ShieldMinus className="h-3.5 w-3.5" />
                      Remove admin
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Make admin
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
