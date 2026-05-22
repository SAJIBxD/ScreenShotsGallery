using System;
using System.IO;
using System.Reflection;

if (args.Length == 0)
{
    Console.WriteLine("Usage: ListResources <path-to-dll>");
    return;
}

var path = args[0];
if (!File.Exists(path))
{
    Console.WriteLine($"File not found: {path}");
    return;
}

var asmName = AssemblyName.GetAssemblyName(Path.GetFullPath(path));
Console.WriteLine("Assembly: " + asmName.FullName);
Console.WriteLine("PublicKeyToken: " + BitConverter.ToString(asmName.GetPublicKeyToken() ?? Array.Empty<byte>()));
var asm = Assembly.LoadFile(Path.GetFullPath(path));
Console.WriteLine("References:");
foreach (var reference in asm.GetReferencedAssemblies())
{
    Console.WriteLine("  " + reference.FullName);
}
Console.WriteLine("Resources:");
foreach (var r in asm.GetManifestResourceNames())
{
    Console.WriteLine("  " + r);
}
