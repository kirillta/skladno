import { publishLimitProfiles, type PublishLimitProfileId } from "@skladno/shared";
import { Banner, Select, TextareaField } from "../../ui/primitives.js";

export function PublishingPreviewView({ publishing }: { 
    publishing: { 
        text: string; 
        count: number; 
        profileId: PublishLimitProfileId; 
        profile: { characterLimit: number }; 
        message: string; 
        messageTone: "info" | "success" | "error";
        setProfile: (id: PublishLimitProfileId) => Promise<void> 
    } 
}) {
    return <div>
        <h2 className="font-semibold">Publishing Preview</h2>
        <Select aria-label="Publishing profile" value={publishing.profileId} onChange={(event) => void publishing.setProfile(event.target.value as PublishLimitProfileId)}>
            {publishLimitProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
        </Select>
        <p className="mt-3 text-sm">{publishing.count} / {publishing.profile.characterLimit} characters</p>
        <TextareaField aria-label="Plain-text publishing preview" className="mt-3 min-h-72" readOnly value={publishing.text} />
        {publishing.message && <Banner className="mt-2" tone={publishing.messageTone}>{publishing.message}</Banner>}
    </div>;
}
