import { Badge, Button, CustomComponent } from "@workspace/ui";
import { connect } from "@workspace/core";

function App() {
  connect();

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">It finally works!</h1>
      <Button variant="outline" className="mb-4">
        OMG!
      </Button>
      <CustomComponent className="my-3 text-blue-500" />
      <Badge variant="destructive" className="px-3 py-1 text-sm">
        I can&apos;t believe it&apos;s finally working
      </Badge>
    </div>
  );
}

export default App;
