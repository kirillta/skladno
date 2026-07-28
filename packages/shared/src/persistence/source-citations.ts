export interface SourceCitation {
    id: string;
    artifactId: string;
    url: string;
    title?: string;
    excerpt?: string;
    uncertainty?: string;
    createdAt: string;
}


export interface CreateSourceCitationInput {
    id?: string;
    artifactId: string;
    url: string;
    title?: string;
    excerpt?: string;
    uncertainty?: string;
}
