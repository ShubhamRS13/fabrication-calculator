import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui";

export const metadata = { title: "Log in" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <div className="mx-auto mt-6 max-w-sm sm:mt-16">
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <Image src="/brand/logo-mark-256.png" alt="" width={40} height={40} />
          <div>
            <h1 className="text-lg font-semibold">Shubhangi Costing</h1>
            <p className="text-sm text-muted">Log in to continue</p>
          </div>
        </div>
        <Suspense fallback={<LoginForm next="/" />}>
          <Form searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  return <LoginForm next={typeof sp.next === "string" ? sp.next : "/"} />;
}
