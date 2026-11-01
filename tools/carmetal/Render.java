import eric.JSprogram.ScriptItem;
import eric.JZirkelCanvas;
import java.awt.EventQueue;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.imageio.ImageIO;
import rene.zirkel.ZirkelCanvas;
import rene.zirkel.graphics.MainGraphics;
import rene.zirkel.objects.PointObject;

// A CaRMetal figure as CaRMetal draws it (see render.sh): opened in
// CaRMetal, whose window shows a few seconds, its points name=x,y moved,
// then its canvas saved as a PNG. Of a .zirs, its page given by
// --page n (from 1), after its menu script --script name has run.
public class Render {
    public static void main(String[] args) throws Exception {
        List<String> rest = new ArrayList<>();
        int page = 1;
        String script = null;
        for (int i = 0; i < args.length; i++)
            if (args[i].equals("--page")) page = Integer.parseInt(args[++i]);
            else if (args[i].equals("--script")) script = args[++i];
            else rest.add(args[i]);
        File figure = new File(rest.get(0));
        if (figure.getName().endsWith(".zirs")) figure = extract(figure, page);
        Main.mainApplication(new String[] { figure.getAbsolutePath() });
        for (int i = 0; i < 100 && JZirkelCanvas.getCurrentZC() == null; i++)
            Thread.sleep(200);
        // Until its figure is built.
        Thread.sleep(3000);
        ZirkelCanvas canvas = JZirkelCanvas.getCurrentZC();
        // Its menu script of that name run, until it ends (or 60 s).
        if (script != null) {
            ScriptItem item = null;
            for (ScriptItem candidate : canvas.getScripts())
                if (candidate.getScriptName().equals(script)) item = candidate;
            if (item == null) throw new Exception("No script " + script);
            final ScriptItem run = item;
            EventQueue.invokeAndWait(run::runScript);
            Thread.sleep(500);
            for (int i = 0; i < 600 && run.isRunning(); i++) Thread.sleep(100);
            Thread.sleep(500);
        }
        File out = new File(rest.get(1));
        List<String> moves = rest.subList(2, rest.size());
        EventQueue.invokeAndWait(() -> {
            try {
                for (String move : moves) {
                    String[] parts = move.split("[=,]");
                    ((PointObject) canvas.getConstruction().find(parts[0])).move(
                        Double.parseDouble(parts[1]),
                        Double.parseDouble(parts[2]));
                }
                canvas.dovalidate();
                int w = canvas.IW, h = canvas.IH;
                BufferedImage image =
                    new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
                Graphics2D g = image.createGraphics();
                MainGraphics graphics = new MainGraphics(g, canvas);
                graphics.setSize(w, h);
                graphics.clearRect(0, 0, w, h, canvas.getBackground());
                canvas.recompute();
                canvas.validate();
                canvas.dopaint(graphics);
                ImageIO.write(image, "png", out);
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
        System.exit(0);
    }

    // The workbook's page-th figure, in a file of its own.
    static File extract(File workbook, int page) throws Exception {
        try (ZipFile zip = new ZipFile(workbook)) {
            List<ZipEntry> figures = new ArrayList<>();
            for (ZipEntry entry : Collections.list(zip.entries()))
                if (entry.getName().endsWith(".zir")) figures.add(entry);
            File figure = File.createTempFile("page", ".zir");
            figure.deleteOnExit();
            Files.copy(
                zip.getInputStream(figures.get(page - 1)),
                figure.toPath(),
                StandardCopyOption.REPLACE_EXISTING);
            return figure;
        }
    }
}
