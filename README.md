# code-axe 🛠️

**Enhance your code editing and refactoring workflow**

`code-axe` is a Visual Studio Code extension that streamlines the process of code manipulation. With simple keyboard shortcuts, you can quickly extract, copy, or expand methods without manual text selection, making refactoring tasks more efficient and error-free. `code-axe` helps you work with method-level code blocks as cohesive units.


## Features

* `code-axe.cutMethod` (ctrl+M X) - Cut the method under the cursor and copy it to the clipboard.
* `code-axe.copyMethod` (ctrl+M C) - Copy the method under the cursor to the clipboard.
* `code-axe.expandMethod` (ctrl+M E) - Expand the method under the cursor.

<video src="https://github.com/user-attachments/assets/a78afd09-a065-4b5d-ad80-2613e99c323b" controls="controls">
</video>

* `code-axe.sortDescendantMethodsUnderCursor` (ctrl+M S) - Sort the descendant methods under the cursor topologically.

<video src="https://github.com/user-attachments/assets/0e43be82-759e-4415-b9ec-a349b33e587c" controls="controls">
</video>

Example:


```csharp
// before
public class TestMethod
{
    public void MethodC()
    {
        Console.WriteLine("Line");
        Console.WriteLine("Line");
        Console.WriteLine("Line");
    }

    public void MethodB()
    {
        MethodC();
        Console.WriteLine("Line");
        Console.WriteLine("Line");
        Console.WriteLine("Line");
    }

    public void MethodA()
    {
        Console.WriteLine("Line");
        MethodB();
        Console.WriteLine("Line");
        Console.WriteLine("Line");
    }
}
```

```csharp
//after
public class TestMethod
{
    public void MethodA()
    {
        Console.WriteLine("Line");
        MethodB();
        Console.WriteLine("Line");
        Console.WriteLine("Line");
    }

    public void MethodB()
    {
        MethodC();
        Console.WriteLine("Line");
        Console.WriteLine("Line");
        Console.WriteLine("Line");
    }

    public void MethodC()
    {
        Console.WriteLine("Line");
        Console.WriteLine("Line");
        Console.WriteLine("Line");
    }
}
```

## Known Issues

* Method overloading is not supported. It will be added in the future.