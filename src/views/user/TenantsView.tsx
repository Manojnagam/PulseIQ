import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrganisationSchema, createBranchSchema, CreateOrganisationInput, CreateBranchInput } from "@/lib/schemas/auth";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/headers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, MapPin, Phone, Shield } from "lucide-react";

export function TenantsView() {
  const { organisations, branches, activeMembership, createOrganisation, createBranch, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [orgModalOpen, setOrgModalOpen] = React.useState(false);
  const [branchModalOpen, setBranchModalOpen] = React.useState(false);

  const orgForm = useForm<CreateOrganisationInput>({
    resolver: zodResolver(createOrganisationSchema),
  });

  const branchForm = useForm<CreateBranchInput>({
    resolver: zodResolver(createBranchSchema),
  });

  const onCreateOrg = async (data: CreateOrganisationInput) => {
    try {
      await createOrganisation(data.name, data.slug);
      addToast({ title: "Organisation Created", type: "success", description: `${data.name} has been added.` });
      setOrgModalOpen(false);
      orgForm.reset();
    } catch (err: any) {
      addToast({ title: "Creation Failed", type: "error", description: err.message });
    }
  };

  const onCreateBranch = async (data: CreateBranchInput) => {
    try {
      await createBranch(data.name, data.code, data.address, data.phone);
      addToast({ title: "Branch Created", type: "success", description: `${data.name} branch registered.` });
      setBranchModalOpen(false);
      branchForm.reset();
    } catch (err: any) {
      addToast({ title: "Creation Failed", type: "error", description: err.message });
    }
  };

  const currentOrgBranches = branches.filter((b) => b.organisationId === activeMembership?.organisationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Tenant Organisation & Branch Operations"
        description="Manage wellness center organisations, branch locations, and staff assignments."
        actions={
          hasPermission("org:manage") && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOrgModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Organisation
              </Button>
              <Button variant="primary" onClick={() => setBranchModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add New Branch
              </Button>
            </div>
          )
        }
      />

      {/* Organisations Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">Registered Organisations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {organisations.map((org) => (
            <Card key={org.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-pulseGreen-100 text-pulseGreen-700 dark:bg-pulseGreen-950 dark:text-pulseGreen-400">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{org.name}</h4>
                    <p className="text-xs text-muted-foreground">slug: {org.slug}</p>
                  </div>
                </div>
                <Badge variant={org.status === "active" ? "default" : "secondary"}>{org.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Branches Grid */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold text-foreground">Branches in {activeMembership?.organisationName}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentOrgBranches.map((branch) => (
            <Card key={branch.id} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground">{branch.name}</h4>
                <Badge variant="outline">{branch.code}</Badge>
              </div>
              {branch.address && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {branch.address}
                </p>
              )}
              {branch.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {branch.phone}
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Add Org Dialog */}
      <Dialog open={orgModalOpen} onOpenChange={setOrgModalOpen}>
        <DialogContent>
          <form onSubmit={orgForm.handleSubmit(onCreateOrg)}>
            <DialogHeader>
              <DialogTitle>Register New Organisation</DialogTitle>
              <DialogDescription>Create a top-level tenant organisation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Input {...orgForm.register("name")} placeholder="Organisation Name" error={orgForm.formState.errors.name?.message} />
              <Input {...orgForm.register("slug")} placeholder="slug (e.g. apex-wellness)" error={orgForm.formState.errors.slug?.message} />
            </div>
            <DialogFooter>
              <Button type="submit" variant="primary">Create Organisation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Branch Dialog */}
      <Dialog open={branchModalOpen} onOpenChange={setBranchModalOpen}>
        <DialogContent>
          <form onSubmit={branchForm.handleSubmit(onCreateBranch)}>
            <DialogHeader>
              <DialogTitle>Register New Branch</DialogTitle>
              <DialogDescription>Add a physical wellness center branch under {activeMembership?.organisationName}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Input {...branchForm.register("name")} placeholder="Branch Name (e.g. Gachibowli Branch)" error={branchForm.formState.errors.name?.message} />
              <Input {...branchForm.register("code")} placeholder="Branch Code (e.g. GCB-01)" error={branchForm.formState.errors.code?.message} />
              <Input {...branchForm.register("address")} placeholder="Address (Optional)" />
              <Input {...branchForm.register("phone")} placeholder="Phone Number (Optional)" />
            </div>
            <DialogFooter>
              <Button type="submit" variant="primary">Create Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
