#!/usr/bin/env python

from gi.repository import Gio, Gtk

class App:
    BASE_KEY = "org.gnome.shell.extensions.mediasplayers"
    def __init__(self):
	settings = Gio.Settings.new(self.BASE_KEY)

	fenetre = Gtk.Window()
        fenetre.connect('destroy', lambda w: Gtk.main_quit())
	fenetre.set_title('MediasPlayers Configuration')
	fenetre.set_default_size(200, 150)	
	fenetre.set_border_width(6)

	fenetre.set_position(Gtk.WindowPosition.CENTER)
        
	vbox = Gtk.VBox(spacing=6)
	fenetre.add(vbox)

	label = Gtk.Label("")
	vbox.pack_start(label, False, True, 0)
	labelT = Gtk.Label("Select your default Player :")
	vbox.pack_start(labelT, False, True, 0)

	player = Gtk.ComboBoxText()
        
	vbox.pack_start(player, False, True, 0)
        player.append_text('Select a Player :')
        player.append_text('Banshee')
        player.append_text('Rhythmbox')
        player.append_text('Clementine')
        player.append_text('Quodlibet')
	player.append_text('Audacious')
        player.connect('changed', self.fct_rappel_change, settings)
        player.set_active(int(settings.get_string("player")))

	label1 = Gtk.Label("")
	vbox.pack_start(label1, False, True, 0)

	hbox = Gtk.HBox(spacing=6)
	vbox.add(hbox)

	label2 = Gtk.Label("'Alt+F2' and type 'r', to apply changes")
	hbox.pack_start(label2, False, True, 0)

	label3 = Gtk.Label("")
	hbox.pack_start(label3, False, True, 0)
	
	button = Gtk.Button("Quit")
        button.connect("clicked", Gtk.main_quit )
	hbox.pack_start(button, False, True, 0)

        fenetre.show_all()

        return

    def fct_rappel_change(self, player,settings):
        modele = player.get_model()
        index = player.get_active()
        if index:
		settings.set_string("player", str(player.get_active()))
        return

def main():
    Gtk.main()
    return

if __name__ == "__main__":
    app = App()
    main()

